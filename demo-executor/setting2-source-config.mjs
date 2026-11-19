// Setting2 browser-source configuration snapshot for the Demo migration.
// Source: app/src/routes/index.tsx, the Object.assign(s, ...) block
// immediately after reading ans-settings. NOT an entry signal or an SL order.
// Browser settings can differ by persisted strategyMode; do not infer active mode.
export const setting2ForcedPaperSettings = Object.freeze({
 intelligenceBoardEnabled:true,
 initialEntryPct:50,
 autoScale:true,
 profitExperimentEnabled:true,
 profitArmUsd:0.30,
 profitFloorUsd:0.10,
 profitGivebackPct:25,
 recoveryEnabled:true,
 recoveryMode:'AUTO',
 recoveryTriggerUsd:0.30,
 recoveryMaxLossUsd:0.75,
 recoveryWaitSec:120,
 recoveryReverseEnabled:false,
 recoveryMaxReversals:0,
 autoMode:'PAPER'
});
export function applySetting2ForcedPaperSettings(savedSettings) {
 if(!savedSettings||typeof savedSettings!=='object'||Array.isArray(savedSettings))throw Error('INVALID_SETTINGS');
 return {...savedSettings,...setting2ForcedPaperSettings};
}
// These are source parity metadata only. Trading remains disabled until
// original signal generation, position state, and exchange-native SL are wired.
export const setting2MigrationStatus=Object.freeze({
 originalStrategyMode:'BROWSER_PERSISTED_NOT_VERIFIED',
 entrySignalsConnected:false,
 originalStopOrdersConnected:false,
 originalProfitProtectionConnected:false,
 automatedDemoTradingEnabled:false
});
