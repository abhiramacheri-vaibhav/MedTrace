// Edge-case tests for MedTrace (owner: Neric Joel, Testing & Deployment Lead).
// Covers custody, dispensing, recall, safety verdict, documents, sensor alerts,
// registration validation and access control. Kept apart from the happy-path
// suite in MedTrace.test.js so the two can grow independently. Every rejected
// path checks the exact revert reason and, where it matters, that the batch
// state did not change.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MedTrace edge cases", function () {
  let medTrace, admin, maker, distributor, pharmacy, regulator, sensor, stranger, distributor2, hospital;
  let MANUFACTURER_ROLE, DISTRIBUTOR_ROLE, PHARMACY_ROLE, REGULATOR_ROLE, SENSOR_ROLE;
  const ONE_YEAR = 365 * 24 * 60 * 60;
  const ONE_DAY = 24 * 60 * 60;
  const Status = { Created: 0, InTransit: 1, Received: 2, Dispensed: 3, Recalled: 4 };
  const DocType = {
    CertificateOfAnalysis: 0,
    TemperatureLog: 1,
    ShippingRecord: 2,
    RegulatorCertificate: 3,
    Other: 4,
  };

  // Deploy a fresh contract and onboard one wallet per role before each test.
  // A second distributor is onboarded for the "legitimate but not the holder" cases.
  // `stranger` never gets a role; `hospital` is only onboarded where a test needs it.
  beforeEach(async function () {
    [admin, maker, distributor, pharmacy, regulator, sensor, stranger, distributor2, hospital] =
      await ethers.getSigners();
    const MedTrace = await ethers.getContractFactory("MedTrace");
    medTrace = await MedTrace.deploy(admin.address);

    MANUFACTURER_ROLE = await medTrace.MANUFACTURER_ROLE();
    DISTRIBUTOR_ROLE = await medTrace.DISTRIBUTOR_ROLE();
    PHARMACY_ROLE = await medTrace.PHARMACY_ROLE();
    REGULATOR_ROLE = await medTrace.REGULATOR_ROLE();
    SENSOR_ROLE = await medTrace.SENSOR_ROLE();

    await medTrace.registerParticipant(maker.address, MANUFACTURER_ROLE, "Acme Pharma");
    await medTrace.registerParticipant(distributor.address, DISTRIBUTOR_ROLE, "FastMed Logistics");
    await medTrace.registerParticipant(distributor2.address, DISTRIBUTOR_ROLE, "Desert Freight");
    await medTrace.registerParticipant(pharmacy.address, PHARMACY_ROLE, "Tempe Pharmacy");
    await medTrace.registerParticipant(regulator.address, REGULATOR_ROLE, "Drug Regulator");
    await medTrace.registerParticipant(sensor.address, SENSOR_ROLE, "IoT Simulator");
  });

  // Helper: manufacturer registers a cold-chain batch (2.0 C to 8.0 C).
  // Returns the new batch ID read back from totalBatches().
  async function registerSampleBatch({ expiry, coaCid = "QmCoaCid" } = {}) {
    const exp = expiry ?? (await time.latest()) + ONE_YEAR;
    await medTrace.connect(maker).registerBatch("Insulin 100IU", "LOT-001", exp, 20, 80, coaCid);
    return await medTrace.totalBatches();
  }

  // Helper: walk a batch manufacturer -> distributor -> pharmacy (status Received).
  async function moveToPharmacy(id) {
    await medTrace.connect(maker).transferCustody(id, distributor.address);
    await medTrace.connect(distributor).confirmReceipt(id);
    await medTrace.connect(distributor).transferCustody(id, pharmacy.address);
    await medTrace.connect(pharmacy).confirmReceipt(id);
  }

  // ---------------------------------------------------------------------
  describe("Custody", function () {
    describe("non-holder hand-off", function () {
      it("rejects a hand-off started by a stranger", async function () {
        const id = await registerSampleBatch();
        await expect(medTrace.connect(stranger).transferCustody(id, distributor.address)).to.be.revertedWith(
          "MedTrace: caller is not the holder"
        );
        const batch = await medTrace.getBatch(id);
        expect(batch.status).to.equal(Status.Created);
        expect(batch.currentHolder).to.equal(maker.address);
        expect(batch.pendingHolder).to.equal(ethers.ZeroAddress);
      });

      it("rejects a hand-off by a registered distributor that does not hold the batch", async function () {
        const id = await registerSampleBatch();
        await expect(medTrace.connect(distributor).transferCustody(id, pharmacy.address)).to.be.revertedWith(
          "MedTrace: caller is not the holder"
        );
        expect((await medTrace.getBatch(id)).status).to.equal(Status.Created);
      });

      it("rejects a hand-off by the pending receiver before it confirms receipt", async function () {
        const id = await registerSampleBatch();
        await medTrace.connect(maker).transferCustody(id, distributor.address);
        await expect(medTrace.connect(distributor).transferCustody(id, pharmacy.address)).to.be.revertedWith(
          "MedTrace: caller is not the holder"
        );
        const batch = await medTrace.getBatch(id);
        expect(batch.pendingHolder).to.equal(distributor.address);
        expect(batch.currentHolder).to.equal(maker.address);
      });

      it("rejects a hand-off by the previous holder once custody has moved on", async function () {
        const id = await registerSampleBatch();
        await medTrace.connect(maker).transferCustody(id, distributor.address);
        await medTrace.connect(distributor).confirmReceipt(id);
        await expect(medTrace.connect(maker).transferCustody(id, distributor2.address)).to.be.revertedWith(
          "MedTrace: caller is not the holder"
        );
        expect((await medTrace.getBatch(id)).currentHolder).to.equal(distributor.address);
      });
    });

    it("rejects a second hand-off while one is still pending", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      await expect(medTrace.connect(maker).transferCustody(id, distributor2.address)).to.be.revertedWith(
        "MedTrace: hand-off already in progress"
      );
      // The original hand-off is untouched.
      const batch = await medTrace.getBatch(id);
      expect(batch.status).to.equal(Status.InTransit);
      expect(batch.pendingHolder).to.equal(distributor.address);
    });

    it("rejects a hand-off to wallets that are not a distributor or pharmacy", async function () {
      const id = await registerSampleBatch();
      // Unregistered wallet, and registered wallets with the wrong role.
      for (const to of [stranger, regulator, sensor, admin]) {
        await expect(medTrace.connect(maker).transferCustody(id, to.address)).to.be.revertedWith(
          "MedTrace: receiver not a distributor or pharmacy"
        );
      }
      const batch = await medTrace.getBatch(id);
      expect(batch.status).to.equal(Status.Created);
      expect(batch.pendingHolder).to.equal(ethers.ZeroAddress);
    });

    it("rejects a hand-off to the zero address", async function () {
      const id = await registerSampleBatch();
      await expect(medTrace.connect(maker).transferCustody(id, ethers.ZeroAddress)).to.be.revertedWith(
        "MedTrace: receiver not a distributor or pharmacy"
      );
    });

    it("rejects a hand-off to self", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      await medTrace.connect(distributor).confirmReceipt(id);
      await expect(medTrace.connect(distributor).transferCustody(id, distributor.address)).to.be.revertedWith(
        "MedTrace: cannot transfer to self"
      );
      expect((await medTrace.getBatch(id)).status).to.equal(Status.Received);
    });

    it("rejects confirmReceipt when the batch is not in transit", async function () {
      const id = await registerSampleBatch();
      // Still at the factory.
      await expect(medTrace.connect(distributor).confirmReceipt(id)).to.be.revertedWith(
        "MedTrace: batch not in transit"
      );
      let batch = await medTrace.getBatch(id);
      expect(batch.status).to.equal(Status.Created);
      expect(batch.currentHolder).to.equal(maker.address);

      // Already received: a second confirmation is rejected too.
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      await medTrace.connect(distributor).confirmReceipt(id);
      await expect(medTrace.connect(distributor).confirmReceipt(id)).to.be.revertedWith(
        "MedTrace: batch not in transit"
      );
      batch = await medTrace.getBatch(id);
      expect(batch.status).to.equal(Status.Received);
      expect(batch.currentHolder).to.equal(distributor.address);
    });

    it("lets a distributor pass the batch to another distributor before the pharmacy", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      await medTrace.connect(distributor).confirmReceipt(id);
      await medTrace.connect(distributor).transferCustody(id, distributor2.address);
      await medTrace.connect(distributor2).confirmReceipt(id);
      expect((await medTrace.getBatch(id)).currentHolder).to.equal(distributor2.address);
    });

    describe("unknown batch IDs", function () {
      for (const badId of [0n, 999n]) {
        it(`reverts with "batch not found" for ID ${badId} on every batch-scoped call`, async function () {
          await registerSampleBatch(); // make sure at least one real batch exists
          const notFound = "MedTrace: batch not found";

          await expect(medTrace.connect(maker).transferCustody(badId, distributor.address)).to.be.revertedWith(notFound);
          await expect(medTrace.connect(distributor).confirmReceipt(badId)).to.be.revertedWith(notFound);
          await expect(medTrace.connect(pharmacy).markDispensed(badId)).to.be.revertedWith(notFound);
          await expect(medTrace.connect(regulator).attachDocument(badId, DocType.Other, "QmDoc")).to.be.revertedWith(
            notFound
          );
          await expect(medTrace.connect(sensor).recordTemperatureAlert(badId, 120, "QmLog")).to.be.revertedWith(
            notFound
          );
          await expect(medTrace.connect(regulator).certifyBatch(badId, "QmCert")).to.be.revertedWith(notFound);
          await expect(medTrace.connect(regulator).recallBatch(badId, "Bad lot")).to.be.revertedWith(notFound);

          await expect(medTrace.getBatch(badId)).to.be.revertedWith(notFound);
          await expect(medTrace.getHistory(badId)).to.be.revertedWith(notFound);
          await expect(medTrace.getDocuments(badId)).to.be.revertedWith(notFound);
        });
      }

      it("treats the next not-yet-registered ID as unknown", async function () {
        const id = await registerSampleBatch();
        await expect(medTrace.getBatch(id + 1n)).to.be.revertedWith("MedTrace: batch not found");
      });
    });
  });

  // ---------------------------------------------------------------------
  describe("Dispensing", function () {
    it("rejects a recall after the batch has been dispensed", async function () {
      const id = await registerSampleBatch();
      await moveToPharmacy(id);
      await medTrace.connect(pharmacy).markDispensed(id);

      await expect(medTrace.connect(regulator).recallBatch(id, "Late contamination report")).to.be.revertedWith(
        "MedTrace: batch already dispensed"
      );
      expect((await medTrace.getBatch(id)).status).to.equal(Status.Dispensed);
    });

    it("rejects any further hand-off or second dispense of a dispensed batch", async function () {
      const id = await registerSampleBatch();
      await moveToPharmacy(id);
      await medTrace.connect(pharmacy).markDispensed(id);

      await expect(medTrace.connect(pharmacy).transferCustody(id, distributor.address)).to.be.revertedWith(
        "MedTrace: batch already dispensed"
      );
      await expect(medTrace.connect(pharmacy).markDispensed(id)).to.be.revertedWith(
        "MedTrace: batch already dispensed"
      );
      await expect(medTrace.connect(regulator).certifyBatch(id, "QmCert")).to.be.revertedWith(
        "MedTrace: batch already dispensed"
      );
      const batch = await medTrace.getBatch(id);
      expect(batch.status).to.equal(Status.Dispensed);
      expect(batch.currentHolder).to.equal(pharmacy.address);
    });

    it("rejects dispensing by a distributor that holds the batch (no pharmacy role)", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      await medTrace.connect(distributor).confirmReceipt(id);

      await expect(medTrace.connect(distributor).markDispensed(id))
        .to.be.revertedWithCustomError(medTrace, "AccessControlUnauthorizedAccount")
        .withArgs(distributor.address, PHARMACY_ROLE);
      expect((await medTrace.getBatch(id)).status).to.equal(Status.Received);
    });

    it("rejects dispensing while the batch is still in transit to the pharmacy", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      await medTrace.connect(distributor).confirmReceipt(id);
      await medTrace.connect(distributor).transferCustody(id, pharmacy.address);

      // The pharmacy is only the pending holder until it confirms.
      await expect(medTrace.connect(pharmacy).markDispensed(id)).to.be.revertedWith(
        "MedTrace: caller is not the holder"
      );
      expect((await medTrace.getBatch(id)).status).to.equal(Status.InTransit);
    });

    it("rejects dispensing by a pharmacy that has already sent the batch onward", async function () {
      const id = await registerSampleBatch();
      await moveToPharmacy(id);
      // Pharmacy returns the batch to a distributor; it is still the holder
      // while in transit, but the batch is no longer in the Received state.
      await medTrace.connect(pharmacy).transferCustody(id, distributor.address);
      await expect(medTrace.connect(pharmacy).markDispensed(id)).to.be.revertedWith(
        "MedTrace: batch not received yet"
      );
      const batch = await medTrace.getBatch(id);
      expect(batch.status).to.equal(Status.InTransit);
      expect(batch.pendingHolder).to.equal(distributor.address);
    });

    it("rejects dispensing a batch that never left the factory", async function () {
      // A wallet holding both roles (e.g. a hospital that compounds its own
      // medicine) still has to go through a received hand-off first.
      await medTrace.registerParticipant(hospital.address, MANUFACTURER_ROLE, "Hospital Lab");
      await medTrace.registerParticipant(hospital.address, PHARMACY_ROLE, "Hospital Lab");
      const expiry = (await time.latest()) + ONE_YEAR;
      await medTrace.connect(hospital).registerBatch("Saline 0.9%", "LOT-H1", expiry, 20, 250, "");
      const id = await medTrace.totalBatches();

      await expect(medTrace.connect(hospital).markDispensed(id)).to.be.revertedWith(
        "MedTrace: batch not received yet"
      );
      expect((await medTrace.getBatch(id)).status).to.equal(Status.Created);
    });

    describe("expiry", function () {
      it("flips the verdict to unsafe and rejects dispensing a day after expiry", async function () {
        const expiry = (await time.latest()) + 30 * ONE_DAY;
        const id = await registerSampleBatch({ expiry });
        await medTrace.connect(regulator).certifyBatch(id, "QmCert");
        await moveToPharmacy(id);

        let [, safe] = await medTrace.verifyBatch(id);
        expect(safe).to.equal(true);

        await time.increaseTo(expiry + ONE_DAY);

        [, safe] = await medTrace.verifyBatch(id);
        expect(safe).to.equal(false);
        await expect(medTrace.connect(pharmacy).markDispensed(id)).to.be.revertedWith("MedTrace: batch expired");
        expect((await medTrace.getBatch(id)).status).to.equal(Status.Received);
      });

      it("allows dispensing one second before expiry", async function () {
        const expiry = (await time.latest()) + 30 * ONE_DAY;
        const id = await registerSampleBatch({ expiry });
        await moveToPharmacy(id);

        await time.setNextBlockTimestamp(expiry - 1);
        await expect(medTrace.connect(pharmacy).markDispensed(id))
          .to.emit(medTrace, "BatchDispensed")
          .withArgs(id, pharmacy.address);
      });

      it("rejects dispensing in the exact second the batch expires", async function () {
        const expiry = (await time.latest()) + 30 * ONE_DAY;
        const id = await registerSampleBatch({ expiry });
        await moveToPharmacy(id);

        await time.setNextBlockTimestamp(expiry);
        await expect(medTrace.connect(pharmacy).markDispensed(id)).to.be.revertedWith("MedTrace: batch expired");
        expect((await medTrace.getBatch(id)).status).to.equal(Status.Received);
      });
    });
  });

  // ---------------------------------------------------------------------
  describe("Recall", function () {
    it("cancels a hand-off in progress and blocks the receiver from confirming", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).transferCustody(id, distributor.address);

      await expect(medTrace.connect(regulator).recallBatch(id, "Contamination found"))
        .to.emit(medTrace, "BatchRecalled")
        .withArgs(id, regulator.address, "Contamination found");

      const batch = await medTrace.getBatch(id);
      expect(batch.status).to.equal(Status.Recalled);
      expect(batch.pendingHolder).to.equal(ethers.ZeroAddress);
      expect(batch.currentHolder).to.equal(maker.address);

      await expect(medTrace.connect(distributor).confirmReceipt(id)).to.be.revertedWith(
        "MedTrace: batch is recalled"
      );
    });

    it("blocks dispensing of a recalled batch already at the pharmacy", async function () {
      const id = await registerSampleBatch();
      await moveToPharmacy(id);
      await medTrace.connect(regulator).recallBatch(id, "Packaging defect");
      await expect(medTrace.connect(pharmacy).markDispensed(id)).to.be.revertedWith("MedTrace: batch is recalled");
      expect((await medTrace.getBatch(id)).status).to.equal(Status.Recalled);
    });

    it("requires a reason", async function () {
      const id = await registerSampleBatch();
      await expect(medTrace.connect(regulator).recallBatch(id, "")).to.be.revertedWith(
        "MedTrace: reason required"
      );
      expect((await medTrace.getBatch(id)).status).to.equal(Status.Created);
    });

    it("only lets a regulator recall", async function () {
      const id = await registerSampleBatch();
      for (const caller of [maker, distributor, pharmacy, sensor, admin, stranger]) {
        await expect(medTrace.connect(caller).recallBatch(id, "Not allowed"))
          .to.be.revertedWithCustomError(medTrace, "AccessControlUnauthorizedAccount")
          .withArgs(caller.address, REGULATOR_ROLE);
      }
      expect((await medTrace.getBatch(id)).status).to.equal(Status.Created);
    });

    it("only lets a regulator certify", async function () {
      const id = await registerSampleBatch();
      for (const caller of [maker, distributor, pharmacy, sensor, admin, stranger]) {
        await expect(medTrace.connect(caller).certifyBatch(id, "QmFakeCert"))
          .to.be.revertedWithCustomError(medTrace, "AccessControlUnauthorizedAccount")
          .withArgs(caller.address, REGULATOR_ROLE);
      }
      expect((await medTrace.getBatch(id)).certified).to.equal(false);
    });

    it("rejects certifying the same batch twice", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(regulator).certifyBatch(id, "QmCert");
      await expect(medTrace.connect(regulator).certifyBatch(id, "QmCert2")).to.be.revertedWith(
        "MedTrace: already certified"
      );
      // Only the first certificate was stored (CoA + one regulator certificate).
      expect((await medTrace.getDocuments(id)).length).to.equal(2);
    });

    it("rejects recalling or certifying a batch that is already recalled", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(regulator).recallBatch(id, "Contamination found");
      const historyBefore = (await medTrace.getHistory(id)).length;

      await expect(medTrace.connect(regulator).recallBatch(id, "Second recall")).to.be.revertedWith(
        "MedTrace: batch is recalled"
      );
      await expect(medTrace.connect(regulator).certifyBatch(id, "QmCert")).to.be.revertedWith(
        "MedTrace: batch is recalled"
      );
      expect((await medTrace.getHistory(id)).length).to.equal(historyBefore);
      expect((await medTrace.getBatch(id)).certified).to.equal(false);
    });

  });

  // ---------------------------------------------------------------------
  describe("Safety verdict (verifyBatch)", function () {
    it("reports an uncertified batch as existing but not safe", async function () {
      const id = await registerSampleBatch();
      const [exists, safe, status, holder] = await medTrace.verifyBatch(id);
      expect(exists).to.equal(true);
      expect(safe).to.equal(false);
      expect(status).to.equal(Status.Created);
      expect(holder).to.equal(maker.address);
    });

    it("reports a certified, in-range, unexpired batch as safe", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(regulator).certifyBatch(id, "QmCert");
      await moveToPharmacy(id);
      const [exists, safe, status, holder] = await medTrace.verifyBatch(id);
      expect(exists).to.equal(true);
      expect(safe).to.equal(true);
      expect(status).to.equal(Status.Received);
      expect(holder).to.equal(pharmacy.address);
    });

    it("flips a certified batch to unsafe after a temperature breach", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(regulator).certifyBatch(id, "QmCert");
      let [, safe] = await medTrace.verifyBatch(id);
      expect(safe).to.equal(true);

      // Below the 2.0 C minimum this time (the main suite covers above-max).
      await medTrace.connect(sensor).recordTemperatureAlert(id, -15, "QmColdLog");
      let exists;
      [exists, safe] = await medTrace.verifyBatch(id);
      expect(exists).to.equal(true);
      expect(safe).to.equal(false);
    });
  });

  // ---------------------------------------------------------------------
  describe("Sensor alerts", function () {
    it("treats readings exactly on the range limits as in range", async function () {
      const id = await registerSampleBatch();
      for (const reading of [20, 80]) {
        await expect(medTrace.connect(sensor).recordTemperatureAlert(id, reading, "")).to.be.revertedWith(
          "MedTrace: reading is within range"
        );
      }
      expect((await medTrace.getBatch(id)).temperatureBreached).to.equal(false);
    });

    it("rejects temperature alerts from a non-sensor wallet", async function () {
      const id = await registerSampleBatch();
      for (const caller of [maker, regulator, stranger]) {
        await expect(medTrace.connect(caller).recordTemperatureAlert(id, 120, "QmLog"))
          .to.be.revertedWithCustomError(medTrace, "AccessControlUnauthorizedAccount")
          .withArgs(caller.address, SENSOR_ROLE);
      }
      expect((await medTrace.getBatch(id)).temperatureBreached).to.equal(false);
    });

    it("rejects sensor alerts on a recalled batch", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(regulator).recallBatch(id, "Contamination found");
      await expect(medTrace.connect(sensor).recordTemperatureAlert(id, 120, "QmLog")).to.be.revertedWith(
        "MedTrace: batch is recalled"
      );
      expect((await medTrace.getBatch(id)).temperatureBreached).to.equal(false);
    });
  });

  // ---------------------------------------------------------------------
  describe("Documents", function () {
    it("lets the current holder attach a document", async function () {
      const id = await registerSampleBatch();
      await expect(medTrace.connect(maker).attachDocument(id, DocType.ShippingRecord, "QmShip"))
        .to.emit(medTrace, "DocumentAttached")
        .withArgs(id, DocType.ShippingRecord, "QmShip", maker.address);
    });

    it("lets a regulator that does not hold the batch attach a document", async function () {
      const id = await registerSampleBatch();
      await expect(medTrace.connect(regulator).attachDocument(id, DocType.Other, "QmInspection"))
        .to.emit(medTrace, "DocumentAttached")
        .withArgs(id, DocType.Other, "QmInspection", regulator.address);
    });

    it("rejects documents from anyone else", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      // Stranger, the pending receiver, and other registered roles are all rejected.
      for (const caller of [stranger, distributor, pharmacy, sensor, admin]) {
        await expect(medTrace.connect(caller).attachDocument(id, DocType.Other, "QmDoc")).to.be.revertedWith(
          "MedTrace: only holder or regulator"
        );
      }
      expect((await medTrace.getDocuments(id)).length).to.equal(1); // just the CoA
    });

    it("rejects the previous holder once custody has moved on", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      await medTrace.connect(distributor).confirmReceipt(id);
      await expect(medTrace.connect(maker).attachDocument(id, DocType.Other, "QmLate")).to.be.revertedWith(
        "MedTrace: only holder or regulator"
      );
    });

    it("rejects an empty CID", async function () {
      const id = await registerSampleBatch();
      await expect(medTrace.connect(maker).attachDocument(id, DocType.ShippingRecord, "")).to.be.revertedWith(
        "MedTrace: empty CID"
      );
      await expect(medTrace.connect(regulator).attachDocument(id, DocType.Other, "")).to.be.revertedWith(
        "MedTrace: empty CID"
      );
      expect((await medTrace.getDocuments(id)).length).to.equal(1); // just the CoA
    });

    it("returns docType, cid and uploadedBy for every stored document", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).attachDocument(id, DocType.ShippingRecord, "QmShip");
      await medTrace.connect(regulator).certifyBatch(id, "QmCert");

      const docs = await medTrace.getDocuments(id);
      expect(docs.length).to.equal(3);

      expect(docs[0].docType).to.equal(DocType.CertificateOfAnalysis);
      expect(docs[0].cid).to.equal("QmCoaCid");
      expect(docs[0].uploadedBy).to.equal(maker.address);

      expect(docs[1].docType).to.equal(DocType.ShippingRecord);
      expect(docs[1].cid).to.equal("QmShip");
      expect(docs[1].uploadedBy).to.equal(maker.address);

      expect(docs[2].docType).to.equal(DocType.RegulatorCertificate);
      expect(docs[2].cid).to.equal("QmCert");
      expect(docs[2].uploadedBy).to.equal(regulator.address);
    });

    it("stores no document when a batch is registered with an empty CoA CID", async function () {
      const id = await registerSampleBatch({ coaCid: "" });
      expect((await medTrace.getDocuments(id)).length).to.equal(0);
      // Only the Registered line, no DocumentAttached line.
      expect((await medTrace.getHistory(id)).length).to.equal(1);
    });

    it("stores no document for a certification or alert with an empty CID", async function () {
      const id = await registerSampleBatch({ coaCid: "" });
      await medTrace.connect(regulator).certifyBatch(id, "");
      await medTrace.connect(sensor).recordTemperatureAlert(id, 120, "");
      expect((await medTrace.getDocuments(id)).length).to.equal(0);
    });
  });

  // ---------------------------------------------------------------------
  describe("Registration validation", function () {
    let expiry;
    beforeEach(async function () {
      expiry = (await time.latest()) + ONE_YEAR;
    });

    it("rejects an empty product name", async function () {
      await expect(medTrace.connect(maker).registerBatch("", "LOT-001", expiry, 20, 80, "")).to.be.revertedWith(
        "MedTrace: empty product name"
      );
      expect(await medTrace.totalBatches()).to.equal(0n);
    });

    it("rejects an empty lot number", async function () {
      await expect(
        medTrace.connect(maker).registerBatch("Insulin 100IU", "", expiry, 20, 80, "")
      ).to.be.revertedWith("MedTrace: empty lot number");
      expect(await medTrace.totalBatches()).to.equal(0n);
    });

    it("rejects an expiry date in the past", async function () {
      const past = (await time.latest()) - ONE_DAY;
      await expect(
        medTrace.connect(maker).registerBatch("Insulin 100IU", "LOT-001", past, 20, 80, "")
      ).to.be.revertedWith("MedTrace: already expired");
      expect(await medTrace.totalBatches()).to.equal(0n);
    });

    it("rejects an expiry date equal to the registration block time", async function () {
      const next = (await time.latest()) + 60;
      await time.setNextBlockTimestamp(next);
      await expect(
        medTrace.connect(maker).registerBatch("Insulin 100IU", "LOT-001", next, 20, 80, "")
      ).to.be.revertedWith("MedTrace: already expired");
      expect(await medTrace.totalBatches()).to.equal(0n);
    });

    it("rejects a min temperature equal to or above the max", async function () {
      await expect(
        medTrace.connect(maker).registerBatch("Insulin 100IU", "LOT-001", expiry, 80, 80, "")
      ).to.be.revertedWith("MedTrace: bad temperature range");
      await expect(
        medTrace.connect(maker).registerBatch("Insulin 100IU", "LOT-001", expiry, 80, 20, "")
      ).to.be.revertedWith("MedTrace: bad temperature range");
      expect(await medTrace.totalBatches()).to.equal(0n);
    });

    it("accepts a sub-zero range for frozen products", async function () {
      await medTrace.connect(maker).registerBatch("Vaccine X", "LOT-F1", expiry, -250, -150, "");
      const batch = await medTrace.getBatch(await medTrace.totalBatches());
      expect(batch.minTempTenthsC).to.equal(-250);
      expect(batch.maxTempTenthsC).to.equal(-150);
    });
  });

  // ---------------------------------------------------------------------
  describe("Access control", function () {
    it("only lets the admin register participants", async function () {
      for (const caller of [maker, regulator, stranger]) {
        await expect(medTrace.connect(caller).registerParticipant(stranger.address, DISTRIBUTOR_ROLE, "Rogue"))
          .to.be.revertedWithCustomError(medTrace, "AccessControlUnauthorizedAccount")
          .withArgs(caller.address, ethers.ZeroHash);
      }
      expect(await medTrace.hasRole(DISTRIBUTOR_ROLE, stranger.address)).to.equal(false);
    });

    it("only lets the admin remove participants", async function () {
      await expect(medTrace.connect(regulator).removeParticipant(maker.address, MANUFACTURER_ROLE))
        .to.be.revertedWithCustomError(medTrace, "AccessControlUnauthorizedAccount")
        .withArgs(regulator.address, ethers.ZeroHash);
      expect(await medTrace.hasRole(MANUFACTURER_ROLE, maker.address)).to.equal(true);
    });

    it("rejects onboarding the zero address", async function () {
      await expect(
        medTrace.registerParticipant(ethers.ZeroAddress, DISTRIBUTOR_ROLE, "Nobody")
      ).to.be.revertedWith("MedTrace: zero address");
    });

    it("rejects roles that are not part of MedTrace", async function () {
      await expect(
        medTrace.registerParticipant(stranger.address, ethers.id("PATIENT_ROLE"), "Patient")
      ).to.be.revertedWith("MedTrace: unknown role");
      // The admin role itself cannot be handed out through registerParticipant.
      await expect(
        medTrace.registerParticipant(stranger.address, ethers.ZeroHash, "Second admin")
      ).to.be.revertedWith("MedTrace: unknown role");
      expect(await medTrace.hasRole(ethers.ZeroHash, stranger.address)).to.equal(false);
    });

    it("stops a removed manufacturer from registering batches", async function () {
      await expect(medTrace.removeParticipant(maker.address, MANUFACTURER_ROLE))
        .to.emit(medTrace, "ParticipantRemoved")
        .withArgs(maker.address, MANUFACTURER_ROLE);

      const expiry = (await time.latest()) + ONE_YEAR;
      await expect(medTrace.connect(maker).registerBatch("Insulin 100IU", "LOT-001", expiry, 20, 80, ""))
        .to.be.revertedWithCustomError(medTrace, "AccessControlUnauthorizedAccount")
        .withArgs(maker.address, MANUFACTURER_ROLE);
      expect(await medTrace.totalBatches()).to.equal(0n);
    });

    it("stops a removed pharmacy from receiving new hand-offs", async function () {
      const id = await registerSampleBatch();
      await medTrace.removeParticipant(pharmacy.address, PHARMACY_ROLE);
      await expect(medTrace.connect(maker).transferCustody(id, pharmacy.address)).to.be.revertedWith(
        "MedTrace: receiver not a distributor or pharmacy"
      );
      expect((await medTrace.getBatch(id)).status).to.equal(Status.Created);
    });
  });
});
