# Release checklist

- [ ] Review the compatibility report above.
- [ ] Deploy the new program to **devnet**.
- [ ] Run the generated migration against a copy of real accounts on devnet.
- [ ] Run the regression test / integration suite against devnet.
- [ ] Verify a sample of existing accounts decode correctly post-upgrade.
- [ ] Confirm every affected account type has been migrated before mainnet.
- [ ] Promote to **mainnet** only after devnet verification passes.
