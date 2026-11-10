// Draft test suite for MedTrace (owner: Neric Joel, Testing & Deployment Lead).
// Covers the main happy path plus the key permission and state rules.
// TODO (interim demo): add tests for documents, expiry edge cases and gas usage.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MedTrace", function () {
  let medTrace, admin, maker, distributor, pharmacy, regulator, sensor, stranger;
  const ONE_YEAR = 365 * 24 * 60 * 60;
  const Status = { Created: 0, InTransit: 1, Received: 2, Dispensed: 3, Recalled: 4 };

  // Deploy a fresh contract and onboard one wallet per role before each test.
  beforeEach(async function () {
    [admin, maker, distributor, pharmacy, regulator, sensor, stranger] = await ethers.getSigners();
    const MedTrace = await ethers.getContractFactory("MedTrace");
    medTrace = await MedTrace.deploy(admin.address);

    await medTrace.registerParticipant(maker.address, await medTrace.MANUFACTURER_ROLE(), "Acme Pharma");
    await medTrace.registerParticipant(distributor.address, await medTrace.DISTRIBUTOR_ROLE(), "FastMed Logistics");
    await medTrace.registerParticipant(pharmacy.address, await medTrace.PHARMACY_ROLE(), "Tempe Pharmacy");
    await medTrace.registerParticipant(regulator.address, await medTrace.REGULATOR_ROLE(), "Drug Regulator");
    await medTrace.registerParticipant(sensor.address, await medTrace.SENSOR_ROLE(), "IoT Simulator");
  });

  // Helper: manufacturer registers a cold-chain batch (2.0 C to 8.0 C).
  async function registerSampleBatch() {
    const expiry = (await time.latest()) + ONE_YEAR;
    await medTrace.connect(maker).registerBatch("Insulin 100IU", "LOT-001", expiry, 20, 80, "QmCoaCid");
    return 1n;
  }

  it("registers a batch with the manufacturer as first holder", async function () {
    const id = await registerSampleBatch();
    const batch = await medTrace.getBatch(id);
    expect(batch.manufacturer).to.equal(maker.address);
    expect(batch.currentHolder).to.equal(maker.address);
    expect(batch.status).to.equal(Status.Created);
    expect(await medTrace.totalBatches()).to.equal(1n);
  });

  it("blocks batch registration from non-manufacturers", async function () {
    const expiry = (await time.latest()) + ONE_YEAR;
    await expect(
      medTrace.connect(stranger).registerBatch("Fake", "LOT-X", expiry, 20, 80, "")
    ).to.be.revertedWithCustomError(medTrace, "AccessControlUnauthorizedAccount");
  });

  it("moves a batch from manufacturer to pharmacy and dispenses it", async function () {
    const id = await registerSampleBatch();

    await expect(medTrace.connect(maker).transferCustody(id, distributor.address))
      .to.emit(medTrace, "CustodyTransferred").withArgs(id, maker.address, distributor.address);
    await medTrace.connect(distributor).confirmReceipt(id);
    await medTrace.connect(distributor).transferCustody(id, pharmacy.address);
    await medTrace.connect(pharmacy).confirmReceipt(id);
    await medTrace.connect(pharmacy).markDispensed(id);

    const batch = await medTrace.getBatch(id);
    expect(batch.status).to.equal(Status.Dispensed);
    expect(batch.currentHolder).to.equal(pharmacy.address);

    // Registered, CoA doc, 2 transfers, 2 receipts, dispensed = 7 history lines.
    const history = await medTrace.getHistory(id);
    expect(history.length).to.equal(7);
  });

  it("only lets the intended receiver confirm a hand-off", async function () {
    const id = await registerSampleBatch();
    await medTrace.connect(maker).transferCustody(id, distributor.address);
    await expect(medTrace.connect(pharmacy).confirmReceipt(id)).to.be.revertedWith(
      "MedTrace: caller is not the receiver"
    );
  });

  it("records temperature alerts only for out-of-range readings", async function () {
    const id = await registerSampleBatch();
    await expect(medTrace.connect(sensor).recordTemperatureAlert(id, 50, "QmLog")).to.be.revertedWith(
      "MedTrace: reading is within range"
    );
    await expect(medTrace.connect(sensor).recordTemperatureAlert(id, 120, "QmLog"))
      .to.emit(medTrace, "TempAlert").withArgs(id, 120, "QmLog");
    expect((await medTrace.getBatch(id)).temperatureBreached).to.equal(true);
  });

  it("lets a regulator certify and recall, and freezes recalled batches", async function () {
    const id = await registerSampleBatch();
    await medTrace.connect(regulator).certifyBatch(id, "QmCert");
    let [, safe] = await medTrace.verifyBatch(id);
    expect(safe).to.equal(true);

    await medTrace.connect(regulator).recallBatch(id, "Contamination found");
    [, safe] = await medTrace.verifyBatch(id);
    expect(safe).to.equal(false);
    await expect(medTrace.connect(maker).transferCustody(id, distributor.address)).to.be.revertedWith(
      "MedTrace: batch is recalled"
    );
  });

  it("reports unknown batch IDs as not existing (possible counterfeit)", async function () {
    const [exists, safe] = await medTrace.verifyBatch(999);
    expect(exists).to.equal(false);
    expect(safe).to.equal(false);
  });

  describe("lot-number lookup", function () {
    it("returns matching IDs for shared lots without losing earlier registrations", async function () {
      const id = await registerSampleBatch();
      const expiry = (await time.latest()) + ONE_YEAR;
      await medTrace.connect(maker).registerBatch("Insulin shipment 2", "LOT-001", expiry, 20, 80, "");
      await medTrace.connect(maker).registerBatch("Other lot", "LOT-002", expiry, 20, 80, "");
      await medTrace.registerParticipant(stranger.address, await medTrace.MANUFACTURER_ROLE(), "Other maker");
      await medTrace.connect(stranger).registerBatch("Other manufacturer", "LOT-001", expiry, 20, 80, "");
      expect(await medTrace.connect(stranger).getBatchIdsByLot("LOT-001")).to.deep.equal([id, 2n, 4n]);
      expect(await medTrace.getBatchIdsByLot("LOT-002")).to.deep.equal([3n]);
      expect((await medTrace.getBatch(4)).manufacturer).to.equal(stranger.address);
    });

    it("uses exact matches and returns no IDs for unknown or empty lots", async function () {
      await registerSampleBatch();
      for (const lot of ["", "UNKNOWN", "lot-001", " LOT-001", "LOT-001 "]) {
        expect(await medTrace.getBatchIdsByLot(lot)).to.deep.equal([]);
      }
    });

    it("keeps the lot index after custody changes and recall", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      await medTrace.connect(distributor).confirmReceipt(id);
      await medTrace.connect(regulator).recallBatch(id, "Quality issue");
      expect(await medTrace.getBatchIdsByLot("LOT-001")).to.deep.equal([id]);
      expect((await medTrace.getBatch(id)).status).to.equal(Status.Recalled);
    });

    it("does not index a rejected registration", async function () {
      const expiry = (await time.latest()) + ONE_YEAR;
      await expect(medTrace.connect(maker).registerBatch("Invalid", "LOT-BAD", expiry, 80, 20, ""))
        .to.be.revertedWith("MedTrace: bad temperature range");
      expect(await medTrace.getBatchIdsByLot("LOT-BAD")).to.deep.equal([]);
      expect(await medTrace.totalBatches()).to.equal(0n);
    });
  });

  describe("temperature-breach dispense rule", function () {
    for (const reading of [19, 81]) {
      for (const certifyFirst of [true, false]) {
        it(`blocks dispensing at ${reading / 10} C with certification ${certifyFirst ? "before" : "after"} the alert`, async function () {
          const id = await registerSampleBatch();
          await medTrace.connect(maker).transferCustody(id, pharmacy.address);
          await medTrace.connect(pharmacy).confirmReceipt(id);
          if (certifyFirst) await medTrace.connect(regulator).certifyBatch(id, "");
          await medTrace.connect(sensor).recordTemperatureAlert(id, reading, "QmLog");
          if (!certifyFirst) await medTrace.connect(regulator).certifyBatch(id, "");
          const history = await medTrace.getHistory(id);
          await expect(medTrace.connect(pharmacy).markDispensed(id))
            .to.be.revertedWith("MedTrace: temperature breached");
          const batch = await medTrace.getBatch(id);
          expect(batch.status).to.equal(Status.Received);
          expect(batch.temperatureBreached).to.equal(true);
          expect((await medTrace.verifyBatch(id)).safeToUse).to.equal(false);
          expect(await medTrace.getHistory(id)).to.deep.equal(history);
        });
      }
    }

    it("allows dispensing when boundary readings are rejected and no breach exists", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).transferCustody(id, pharmacy.address);
      await medTrace.connect(pharmacy).confirmReceipt(id);
      for (const reading of [20, 80]) {
        await expect(medTrace.connect(sensor).recordTemperatureAlert(id, reading, ""))
          .to.be.revertedWith("MedTrace: reading is within range");
      }
      await medTrace.connect(regulator).certifyBatch(id, "");
      await expect(medTrace.connect(pharmacy).markDispensed(id))
        .to.emit(medTrace, "BatchDispensed").withArgs(id, pharmacy.address);
      expect((await medTrace.verifyBatch(id)).safeToUse).to.equal(true);
      expect(await medTrace.getBatchIdsByLot("LOT-001")).to.deep.equal([id]);
    });

    it("allows breached stock to be transferred for quarantine and recalled", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(sensor).recordTemperatureAlert(id, 90, "");
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      await medTrace.connect(distributor).confirmReceipt(id);
      await medTrace.connect(regulator).recallBatch(id, "Cold chain failed");
      expect((await medTrace.getBatch(id)).status).to.equal(Status.Recalled);
    });
  });

  describe("history pagination", function () {
    it("reconstructs full history across pages, including a partial last page", async function () {
      const id = await registerSampleBatch();
      await medTrace.connect(maker).transferCustody(id, distributor.address);
      await medTrace.connect(distributor).confirmReceipt(id);
      await medTrace.connect(sensor).recordTemperatureAlert(id, 90, "log");
      const full = await medTrace.getHistory(id);
      const combined = [];
      for (let offset = 0; offset < full.length; offset += 4) {
        const [entries, total] = await medTrace.getHistoryPage(id, offset, 4);
        expect(total).to.equal(BigInt(full.length));
        combined.push(...entries);
      }
      expect(combined).to.deep.equal(Array.from(full));
      const [entries, total] = await medTrace.getHistoryPage(id, 1, ethers.MaxUint256);
      expect(entries).to.deep.equal(full.slice(1));
      expect(total).to.equal(BigInt(full.length));
    });

    it("returns empty pages for zero limits and offsets at or beyond the end", async function () {
      const id = await registerSampleBatch();
      for (const [offset, limit] of [[0, 0], [2, 10], [3, 10], [ethers.MaxUint256, ethers.MaxUint256]]) {
        const [entries, total] = await medTrace.getHistoryPage(id, offset, limit);
        expect(entries).to.deep.equal([]);
        expect(total).to.equal(2n);
      }
    });

    it("rejects unknown batches", async function () {
      for (const id of [0, 1]) {
        await expect(medTrace.getHistoryPage(id, 0, 10))
          .to.be.revertedWith("MedTrace: batch not found");
      }
    });

    it("keeps earlier offsets stable when history grows", async function () {
      const id = await registerSampleBatch();
      const [before] = await medTrace.getHistoryPage(id, 0, 2);
      await medTrace.connect(maker).attachDocument(id, 4, "extra");
      const [after, total] = await medTrace.getHistoryPage(id, 0, 2);
      expect(after).to.deep.equal(before);
      expect(total).to.equal(3n);
      const [tail] = await medTrace.getHistoryPage(id, 2, 2);
      expect(tail[0].details).to.equal("extra");
    });
  });

});
