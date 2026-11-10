import HolderPage from "./HolderPage.jsx";
import TxButton from "../components/TxButton.jsx";
import { useWallet } from "../lib/wallet.jsx";

export default function Pharmacy() {
  return (
    <HolderPage
      title="Pharmacy"
      intro="Accept deliveries and dispense medicine to patients."
      extraActions={(batch, reload) => <DispenseButton batch={batch} onDone={reload} />}
    />
  );
}

function DispenseButton({ batch, onDone }) {
  const w = useWallet();
  return (
    <TxButton className="btn success" send={() => w.writer.markDispensed(batch.id)} success={`Batch #${batch.id} dispensed. It is now frozen.`} onDone={onDone}
      confirm="Dispensing is final. The batch can't be moved or changed afterwards. Continue?">
      Dispense to patient
    </TxButton>
  );
}
