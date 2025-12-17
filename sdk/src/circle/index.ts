/**
 * Circle Integration Module
 *
 * Provides Circle Programmable Wallets and Compliance Engine integration
 * for Arc Agents.
 */

// Wallet exports
export {
  CircleWallets,
  createCircleWallets,
  type CircleWalletsConfig,
  type CircleWallet,
  type WalletStatus,
  type BlockchainType,
  type CreateWalletOptions,
  type WalletSet,
  type TransactionRequest,
  type TransactionResponse,
} from './wallets';

// Compliance exports
export {
  CircleCompliance,
  createCircleCompliance,
  type ComplianceConfig,
  type ScreeningStatus,
  type RiskLevel,
  type ScreeningResult,
  type ScreeningOptions,
  type BatchScreeningOptions,
} from './compliance';
