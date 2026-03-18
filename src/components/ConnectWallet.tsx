import React from 'react';
import { Wallet } from 'lucide-react';

interface ConnectWalletProps {
  onConnect: () => void;
}

const ConnectWallet: React.FC<ConnectWalletProps> = ({ onConnect }) => {
  return (
    <button
      onClick={onConnect}
      className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full inline-flex items-center transition duration-300"
    >
      <Wallet className="mr-2" />
      Connect Wallet
    </button>
  );
};

export default ConnectWallet;