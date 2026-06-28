// Generated migration scaffold for `AmmConfig`.
// Review and complete the field copy before running on mainnet.
use anchor_lang::prelude::*;

// Old layout (already on chain).
#[account]
pub struct AmmConfigV1 {
    pub bump: u8,
    pub index: u16,
    pub owner: Pubkey,
    pub protocol_fee_rate: u32,
    pub trade_fee_rate: u32,
    pub tick_spacing: u16,
    pub fund_fee_rate: u32,
    pub padding_u32: u32,
    pub fund_owner: Pubkey,
    pub padding: [u64; 3],
}

// New layout (target).
#[account]
pub struct AmmConfigV2 {
    pub bump: u8,
    pub index: u16,
    pub owner: Pubkey,
    pub protocol_fee_rate: u32,
    pub trade_fee_rate: u64,
    pub tick_spacing: u16,
    pub fund_fee_rate: u32,
    pub padding_u32: u32,
    pub fund_owner: Pubkey,
    pub padding: [u64; 3],
}

#[derive(Accounts)]
pub struct Migrate<'info> {
    #[account(
        mut,
        realloc = 8 + std::mem::size_of::<AmmConfigV2>(),
        realloc::payer = payer,
        realloc::zero = false,
    )]
    /// CHECK: deserialized manually as AmmConfigV1, rewritten as AmmConfigV2.
    pub account: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn migrate(ctx: Context<Migrate>) -> Result<()> {
    let info = &ctx.accounts.account;
    let old = AmmConfigV1::try_deserialize(&mut &info.try_borrow_data()?[..])?;

    // TODO: map every old field into the new layout. Defaults are placeholders.
    let new = AmmConfigV2 {
        // ..copy matching fields from `old`, set new/changed fields explicitly..
        ..Default::default()
    };

    let mut data = info.try_borrow_mut_data()?;
    new.try_serialize(&mut &mut data[..])?;
    let _ = old;
    Ok(())
}
