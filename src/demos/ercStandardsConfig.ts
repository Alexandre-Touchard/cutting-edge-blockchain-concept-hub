import type React from 'react';
import { ArrowRightLeft, Coins, Images, Layers, ShieldCheck } from 'lucide-react';

export type StandardId =
  | 'erc20'
  | 'erc721'
  | 'erc1155'
  | 'erc1400'
  | 'erc777'
  | 'erc998'
  | 'erc4626'
  | 'erc223'
  | 'erc827'
  | 'erc4337'
  | 'erc864'
  | 'erc865'
  | 'erc6551'
  | 'erc1132'
  | 'erc1203';

export type Standard = {
  id: StandardId;
  name: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  status: 'ready' | 'coming_soon';
  summary: string;
  eipUrl?: string;
};

export const ERC_STANDARDS: Standard[] = [
  {
    id: 'erc20',
    name: 'ERC-20 (Fungible Tokens)',
    icon: Coins,
    status: 'ready',
    summary: 'Balances + allowance-based spending (approve/transferFrom).',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-20'
  },
  {
    id: 'erc721',
    name: 'ERC-721 (NFTs)',
    icon: Images,
    status: 'ready',
    summary: 'Unique token IDs + ownership + approvals.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-721'
  },
  {
    id: 'erc1155',
    name: 'ERC-1155 (Multi-Token)',
    icon: Layers,
    status: 'ready',
    summary: 'Many token IDs (fungible and NFT-like) in one contract.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-1155'
  },
  {
    id: 'erc1400',
    name: 'ERC-1400 (Security Tokens)',
    icon: ShieldCheck,
    status: 'ready',
    summary: 'Partially-fungible security tokens with compliance partitions.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-1400'
  },
  {
    id: 'erc777',
    name: 'ERC-777',
    icon: ArrowRightLeft,
    status: 'ready',
    summary: 'Fungible tokens with hooks and operators.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-777'
  },
  {
    id: 'erc998',
    name: 'ERC-998',
    icon: Layers,
    status: 'ready',
    summary: 'Composable NFTs (NFTs owning other assets).',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-998'
  },
  {
    id: 'erc4626',
    name: 'ERC-4626',
    icon: Coins,
    status: 'ready',
    summary: 'Tokenized vaults (shares <-> assets) standard.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-4626'
  },
  {
    id: 'erc223',
    name: 'ERC-223',
    icon: ArrowRightLeft,
    status: 'ready',
    summary: 'Safer token transfers to contracts.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-223'
  },
  {
    id: 'erc827',
    name: 'ERC-827',
    icon: ArrowRightLeft,
    status: 'ready',
    summary: 'ERC-20 extensions enabling call data on transfers.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-827'
  },

  // Coming soon
  {
    id: 'erc4337',
    name: 'ERC-4337 (Account Abstraction)',
    icon: ShieldCheck,
    status: 'ready',
    summary: 'UserOperations, bundlers, paymasters.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-4337'
  },
  {
    id: 'erc864',
    name: 'ERC-864',
    icon: Layers,
    status: 'ready',
    summary: 'Delegated token transfers / reusable approvals.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-864'
  },
  {
    id: 'erc865',
    name: 'ERC-865',
    icon: Layers,
    status: 'ready',
    summary: 'Meta-transactions for ERC-20 transfers.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-865'
  },
  {
    id: 'erc6551',
    name: 'ERC-6551 (Token Bound Accounts)',
    icon: ShieldCheck,
    status: 'coming_soon',
    summary: 'NFTs own smart accounts.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-6551'
  },
  {
    id: 'erc1132',
    name: 'ERC-1132 (Token Locking)',
    icon: ShieldCheck,
    status: 'coming_soon',
    summary: 'Locking and unlocking token balances.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-1132'
  },
  {
    id: 'erc1203',
    name: 'ERC-1203 (Multi-class tokens)',
    icon: Layers,
    status: 'coming_soon',
    summary: 'Tokens with multiple classes/attributes.',
    eipUrl: 'https://eips.ethereum.org/EIPS/eip-1203'
  }
];
