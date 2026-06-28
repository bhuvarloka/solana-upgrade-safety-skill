// TODO: complete the field copy in migrate() before mainnet.
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Default)]
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

#[derive(AnchorSerialize, AnchorDeserialize, Default)]
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
    #[account(mut)]
    /// CHECK: deserialized as AmmConfigV1, rewritten as AmmConfigV2.
    pub account: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn migrate(ctx: Context<Migrate>) -> Result<()> {
    let info = &ctx.accounts.account;

    // Keep the original discriminator — the program still reads this as `AmmConfig`.
    let disc: [u8; 8] = info.try_borrow_data()?[..8].try_into().unwrap();
    let old = AmmConfigV1::deserialize(&mut &info.try_borrow_data()?[8..])?;

    let new = AmmConfigV2 {
        // TODO: copy matching fields from `old`; set new/changed fields explicitly.
        ..Default::default()
    };

    let body = new.try_to_vec()?;
    let needed = 8 + body.len();
    if needed != info.data_len() {
        let rent = Rent::get()?;
        let min = rent.minimum_balance(needed);
        let cur = info.lamports();
        if min > cur {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: info.to_account_info(),
                    },
                ),
                min - cur,
            )?;
        }
        info.realloc(needed, false)?;
    }

    let mut data = info.try_borrow_mut_data()?;
    data[..8].copy_from_slice(&disc);
    data[8..needed].copy_from_slice(&body);
    let _ = old;
    Ok(())
}
