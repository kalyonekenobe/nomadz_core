use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;

declare_id!("Fj9Xo9jE9wLv5NbhMMVvJy4S7xGKtgRmuBN8JYic3ary");

#[program]
pub mod nomadz_core {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, lvl_percentages: [u8; 2]) -> Result<()> {
        instructions::initialize::initialize_handler(ctx, lvl_percentages)
    }

    pub fn initialize_user_asset_data(
        ctx: Context<InitializeUserAssetData>,
        user_id: String,
        xp: u64,
        level: u8,
        luck: u8
    ) -> Result<()> {
        initialize_user_asset_data_handler(ctx, user_id, xp, level, luck)
    }

    pub fn update_user_asset_data(
        ctx: Context<UpdateUserStats>,
        user_id: String,
        xp: u64,
        level: u8,
        luck: u8
    ) -> Result<()> {
        update_user_stats_handler(ctx, user_id, xp, level, luck)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_admin: Pubkey,
        lvl_percentages: [u8; 2]
    ) -> Result<()> {
        instructions::config::update_config::update_config_handler(ctx, new_admin, lvl_percentages)
    }

    pub fn apply_referral(ctx: Context<ApplyReferral>) -> Result<()> {
        instructions::apply_referral::apply_referral_handler(ctx)
    }

    pub fn mint_soulbound_nft(
        ctx: Context<MintSoulboundNFT>,
        data: MintSoulboundNFTArgs
    ) -> Result<()> {
        instructions::soulbound::mint_soulbound_nft::mint_soulbound_nft_handler(ctx, data)
    }

    pub fn update_soulbound_nft(
        ctx: Context<UpdateSoulboundNFT>,
        data: UpdateSoulboundNFTArgs
    ) -> Result<()> {
        instructions::soulbound::update_soulbound_nft::update_soulbound_nft_handler(ctx, data)
    }
}
