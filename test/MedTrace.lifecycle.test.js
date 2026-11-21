// Lifecycle tests for MedTrace (owner: Neric Joel, Testing & Deployment Lead).
// Fills the gaps the coverage report and the final-project checklist pointed at:
// the patient safety verdict in every final state, expiry as seen by the patient
// page, document rules after a batch is frozen, and the status snapshot that each
// history line keeps. The other suites cover the single rules; these tests follow
// one batch through several steps and check what a reader of the chain would see.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MedTrace lifecycle", function () {
  let medTrace, admin, maker, distributor, pharmacy, regulator, sensor, stranger;
  const ONE_YEAR = 365 * 24 * 60 * 60;
  const ONE_DAY = 24 * 60 * 60;
  const Status = { Created: 0, InTransit: 1, Received: 2, Dispensed: 3, Recalled: 4 };
  const DocType = { CertificateOfAnalysis: 0, TemperatureLog: 1, ShippingRecord: 2, RegulatorCertificate: 3, Other: 4 };
  const Action = {
    Registered: 0,
    CustodyTransferred: 1,
    ReceiptConfirmed: 2,
    Dispensed: 3,
    DocumentAttached: 4,
    TemperatureAlert: 5,
    Certified: 6,
    Recalled: 7,
  };

  beforeEach(async function () {
    [admin, maker, distributor, pharmacy, regulator, sensor, stranger] = await ethers.getSigners();
    medTrace = await (await ethers.getContractFactory("MedTrace")).deploy(admin.address);

    await medTrace.registerParticipant(maker.address, await medTrace.MANUFACTURER_ROLE(), "Acme Pharma");
    await medTrace.registerParticipant(distributor.address, await medTrace.DISTRIBUTOR_ROLE(), "FastMed Logistics");
    await medTrace.registerParticipant(pharmacy.address, await medTrace.PHARMACY_ROLE(), "Tempe Pharmacy");
    await medTrace.registerParticipant(regulator.address, await medTrace.REGULATOR_ROLE(), "Drug Regulator");
    await medTrace.registerParticipant(sensor.address, await medTrace.SENSOR_ROLE(), "IoT Simulator");
  });

  // Helper: cold-chain batch (2.0 C to 8.0 C). Returns the new batch ID.
  async function registerSampleBatch({ expiry, coaCid = "QmCoaCid" } = {}) {
    const exp = expiry ?? (await time.latest()) + ONE_YEAR;
    await medTrace.connect(maker).registerBatch("Insulin 100IU", "LOT-001", exp, 20, 80, coaCid);
    return await medTrace.totalBatches();
  }

  // Helper: manufacturer -> distributor -> pharmacy, ending in Received.
  async function moveToPharmacy(id) {
    await medTrace.connect(maker).transferCustody(id, distributor.address);
    await medTrace.connect(distributor).confirmReceipt(id);
    await medTrace.connect(distributor).transferCustody(id, pharmacy.address);
    await medTrace.connect(pharmacy).confirmReceipt(id);
  }

  // ---------------------------------------------------------------------
  describe("patient verdict in final states", function () {
    // IDs start at 1, so 0 is never a real batch. A QR code or link with id=0
    // must read as "not found" instead of reverting the patient page.
    it("reports batch ID 0 as not existing, before and after batches exist", async function () {
      for (let round = 0; round < 2; round++) {
        const [exists, safe, status, holder] = await medTrace.verifyBatch(0);
        expect(exists).to.equal(false);
        expect(safe).to.equal(false);
        expect(status).to.equal(Status.Created);
        expect(holder).to.equal(ethers.ZeroAddress);
        await registerSampleBatch();
      }
    });

    // The safety check is certified && !recalled && !breached && !expired.
    // A batch that was certified and then recalled is the one case where the
    // certification passes but the recall still has to turn the answer to "unsafe".
    it("reports a certified batch as unsafe once it is recalled", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(regulator).certifyBatch(id, "QmCert");
      await moveToPharmacy(id);
      expect((await medTrace.verifyBatch(id)).safeToUse).to.equal(true);

      await medTrace.connect(regulator).recallBatch(id, "Contamination found");

      const [exists, safe, status, holder] = await medTrace.verifyBatch(id);
      expect(exists).to.equal(true);
      expect(safe).to.equal(false);
      expect(status).to.equal(Status.Recalled);
      expect(holder).to.equal(pharmacy.address); // recall does not move the stock
    });

    // A patient scans the box after the pharmacy hands it over, so a dispensed
    // batch must still read as safe if nothing went wrong on the way.
    it("keeps a certified batch safe after it is dispensed", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(regulator).certifyBatch(id, "QmCert");
      await moveToPharmacy(id);
      await medTrace.connect(pharmacy).markDispensed(id);

      const [exists, safe, status, holder] = await medTrace.verifyBatch(id);
      expect(exists).to.equal(true);
      expect(safe).to.equal(true);
      expect(status).to.equal(Status.Dispensed);
      expect(holder).to.equal(pharmacy.address);
    });

    it("reports an uncertified batch as unsafe even after it is dispensed", async function () {
      const id = await registerSampleBatch();
      await moveToPharmacy(id);
      await medTrace.connect(pharmacy).markDispensed(id);
      const [exists, safe, status] = await medTrace.verifyBatch(id);
      expect(exists).to.equal(true);
      expect(safe).to.equal(false);
      expect(status).to.equal(Status.Dispensed);
    });

    it("keeps a dispensed batch safe as it ages, until its expiry date", async function () {
      const expiry = (await time.latest()) + 30 * ONE_DAY;
      const id = await registerSampleBatch({ expiry });
      await medTrace.connect(regulator).certifyBatch(id, "QmCert");
      await moveToPharmacy(id);
      await medTrace.connect(pharmacy).markDispensed(id);

      await time.increaseTo(expiry - 1);
      expect((await medTrace.verifyBatch(id)).safeToUse).to.equal(true);
      await time.increase(1);
      expect((await medTrace.verifyBatch(id)).safeToUse).to.equal(false);
    });
  });

  // ---------------------------------------------------------------------
  describe("expiry", function () {
    // verifyBatch is a view, so it is judged against the latest block's time.
    it("turns the patient verdict to unsafe in the exact second the batch expires", async function () {
      const expiry = (await time.latest()) + 10 * ONE_DAY;
      const id = await registerSampleBatch({ expiry });
      await medTrace.connect(regulator).certifyBatch(id, "QmCert");

      await time.increaseTo(expiry - 1);
      expect((await medTrace.verifyBatch(id)).safeToUse).to.equal(true);

      await time.increaseTo(expiry);
      const [exists, safe, status] = await medTrace.verifyBatch(id);
      expect(exists).to.equal(true);
      expect(safe).to.equal(false);
      expect(status).to.equal(Status.Created); // expiry is not a status change
    });

    // Expired stock still has to go somewhere (back to the maker or to disposal),
    // so expiry blocks dispensing but not hand-offs or a recall.
    it("still lets expired stock be handed back and recalled, but never dispensed", async function () {
      const expiry = (await time.latest()) + 10 * ONE_DAY;
      const id = await registerSampleBatch({ expiry });
      await moveToPharmacy(id);
      await time.increaseTo(expiry + ONE_DAY);

      await expect(medTrace.connect(pharmacy).markDispensed(id)).to.be.revertedWithCustomError(medTrace, "BatchExpired");

      await expect(medTrace.connect(pharmacy).transferCustody(id, distributor.address))
        .to.emit(medTrace, "CustodyTransferred")
        .withArgs(id, pharmacy.address, distributor.address);
      await medTrace.connect(distributor).confirmReceipt(id);
      await expect(medTrace.connect(regulator).recallBatch(id, "Expired stock"))
        .to.emit(medTrace, "BatchRecalled")
        .withArgs(id, regulator.address, "Expired stock");
      expect((await medTrace.getBatch(id)).status).to.equal(Status.Recalled);
    });

    it("accepts the largest expiry date a uint64 can hold", async function () {
      const maxExpiry = 2n ** 64n - 1n;
      const id = await registerSampleBatch({ expiry: maxExpiry });
      expect((await medTrace.getBatch(id)).expiryDate).to.equal(maxExpiry);
      await medTrace.connect(regulator).certifyBatch(id, "");
      expect((await medTrace.verifyBatch(id)).safeToUse).to.equal(true);
    });
  });

  // ---------------------------------------------------------------------
  describe("documents", function () {
    // Investigation reports usually arrive after a recall, so attachDocument has
    // no "batch is frozen" check. Only the regulator or the holder can add one.
    it("lets the regulator attach a report after a recall", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(regulator).recallBatch(id, "Contamination found");
      await expect(medTrace.connect(regulator).attachDocument(id, DocType.Other, "QmInvestigation"))
        .to.emit(medTrace, "DocumentAttached")
        .withArgs(id, DocType.Other, "QmInvestigation", regulator.address);
      const docs = await medTrace.getDocuments(id);
      expect(docs[docs.length - 1].cid).to.equal("QmInvestigation");
    });

    it("lets the pharmacy attach a record after dispensing, but not the earlier holders", async function () {
      const id = await registerSampleBatch();
      await moveToPharmacy(id);
      await medTrace.connect(pharmacy).markDispensed(id);

      await expect(medTrace.connect(pharmacy).attachDocument(id, DocType.ShippingRecord, "QmDispenseLog"))
        .to.emit(medTrace, "DocumentAttached")
        .withArgs(id, DocType.ShippingRecord, "QmDispenseLog", pharmacy.address);
      for (const caller of [maker, distributor]) {
        await expect(medTrace.connect(caller).attachDocument(id, DocType.Other, "QmLate")).to.be.revertedWithCustomError(medTrace, "CallerNotHolderOrRegulator");
      }
    });

    it("rejects a document type outside the DocType list", async function () {
      const id = await registerSampleBatch();
      const before = await medTrace.getDocuments(id);
      // 5 is one past `Other`; the ABI decoder refuses to turn it into an enum.
      await expect(medTrace.connect(maker).attachDocument(id, 5, "QmBadType")).to.be.reverted;
      expect(await medTrace.getDocuments(id)).to.deep.equal(before);
    });

    it("writes a DocumentAttached history line with the CID for every stored document", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).attachDocument(id, DocType.ShippingRecord, "QmShip");
      await medTrace.connect(sensor).recordTemperatureAlert(id, 95, "QmLog");

      const docCids = (await medTrace.getDocuments(id)).map((d) => d.cid);
      const historyCids = (await medTrace.getHistory(id))
        .filter((h) => h.action === BigInt(Action.DocumentAttached))
        .map((h) => h.details);
      expect(docCids).to.deep.equal(["QmCoaCid", "QmShip", "QmLog"]);
      expect(historyCids).to.deep.equal(docCids);
    });

    it("keeps documents separate per batch", async function () {
      const first = await registerSampleBatch({ coaCid: "QmCoaA" });
      const second = await registerSampleBatch({ coaCid: "QmCoaB" });
      await medTrace.connect(maker).attachDocument(second, DocType.ShippingRecord, "QmShipB");

      expect((await medTrace.getDocuments(first)).map((d) => d.cid)).to.deep.equal(["QmCoaA"]);
      expect((await medTrace.getDocuments(second)).map((d) => d.cid)).to.deep.equal(["QmCoaB", "QmShipB"]);
    });
  });

  // ---------------------------------------------------------------------
  describe("history snapshots", function () {
    // Each history line stores who acted and the status right after the step,
    // so the web app can draw the custody road without replaying events.
    it("records the actor and status after every step of a full journey", async function () {
      const id = await registerSampleBatch({ coaCid: "" });
      await medTrace.connect(regulator).certifyBatch(id, "");
      await moveToPharmacy(id);
      await medTrace.connect(pharmacy).markDispensed(id);

      const history = await medTrace.getHistory(id);
      const summary = history.map((h) => [Number(h.action), h.actor, Number(h.status)]);
      expect(summary).to.deep.equal([
        [Action.Registered, maker.address, Status.Created],
        [Action.Certified, regulator.address, Status.Created],
        [Action.CustodyTransferred, maker.address, Status.InTransit],
        [Action.ReceiptConfirmed, distributor.address, Status.Received],
        [Action.CustodyTransferred, distributor.address, Status.InTransit],
        [Action.ReceiptConfirmed, pharmacy.address, Status.Received],
        [Action.Dispensed, pharmacy.address, Status.Dispensed],
      ]);
      expect(history[0].details).to.equal("Insulin 100IU");
    });

    it("records a recall with its reason and the Recalled status", async function () {
      const id = await registerSampleBatch({ coaCid: "" });
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      await medTrace.connect(regulator).recallBatch(id, "Seal broken");

      const last = (await medTrace.getHistory(id)).at(-1);
      expect(last.action).to.equal(BigInt(Action.Recalled));
      expect(last.actor).to.equal(regulator.address);
      expect(last.status).to.equal(BigInt(Status.Recalled));
      expect(last.details).to.equal("Seal broken");
      expect((await medTrace.getBatch(id)).pendingHolder).to.equal(ethers.ZeroAddress);
    });

    it("stamps each line with the block time it was written in", async function () {
      const id = await registerSampleBatch({ coaCid: "" });
      const registeredAt = await time.latest();
      await time.increase(ONE_DAY);
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      const transferredAt = await time.latest();

      const history = await medTrace.getHistory(id);
      expect(history[0].timestamp).to.equal(BigInt(registeredAt));
      expect(history[1].timestamp).to.equal(BigInt(transferredAt));
      expect(transferredAt - registeredAt).to.be.greaterThanOrEqual(ONE_DAY);
    });

    it("pages a long history in order with a page size of one", async function () {
      const id = await registerSampleBatch();
      await moveToPharmacy(id);
      const full = await medTrace.getHistory(id);

      for (let i = 0; i < full.length; i++) {
        const [entries, total] = await medTrace.getHistoryPage(id, i, 1);
        expect(total).to.equal(BigInt(full.length));
        expect(entries).to.deep.equal([full[i]]);
      }
    });

    it("keeps a separate history per batch", async function () {
      const first = await registerSampleBatch({ coaCid: "" });
      const second = await registerSampleBatch({ coaCid: "" });
      await medTrace.connect(maker).transferCustody(second, distributor.address);

      expect((await medTrace.getHistory(first)).length).to.equal(1);
      expect((await medTrace.getHistory(second)).length).to.equal(2);
      const [, totalFirst] = await medTrace.getHistoryPage(first, 0, 10);
      expect(totalFirst).to.equal(1n);
    });
  });

  // ---------------------------------------------------------------------
  describe("participants", function () {
    it("updates the display name when a wallet is onboarded again", async function () {
      const role = await medTrace.DISTRIBUTOR_ROLE();
      await expect(medTrace.registerParticipant(stranger.address, role, "Old Name"))
        .to.emit(medTrace, "ParticipantRegistered")
        .withArgs(stranger.address, role, "Old Name");
      await medTrace.registerParticipant(stranger.address, role, "New Name");
      expect(await medTrace.participantName(stranger.address)).to.equal("New Name");
      expect(await medTrace.hasRole(role, stranger.address)).to.equal(true);
    });

    it("lets one wallet hold two roles, and removing one keeps the other", async function () {
      const distributorRole = await medTrace.DISTRIBUTOR_ROLE();
      const pharmacyRole = await medTrace.PHARMACY_ROLE();
      await medTrace.registerParticipant(stranger.address, distributorRole, "Hospital Supply");
      await medTrace.registerParticipant(stranger.address, pharmacyRole, "Hospital Supply");
      await medTrace.removeParticipant(stranger.address, pharmacyRole);

      expect(await medTrace.hasRole(distributorRole, stranger.address)).to.equal(true);
      expect(await medTrace.hasRole(pharmacyRole, stranger.address)).to.equal(false);
      // Still a valid receiver because it is a distributor.
      const id = await registerSampleBatch();
      await expect(medTrace.connect(maker).transferCustody(id, stranger.address))
        .to.emit(medTrace, "CustodyTransferred")
        .withArgs(id, maker.address, stranger.address);
    });
  });
});
