import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { NomadzCore } from "../../../target/types/nomadz_core";
import { saveAccount } from "../../../utils/account_utils";
import * as dotenv from "dotenv";
import * as assert from "assert";
dotenv.config();

describe("referral pipeline with XP from mint", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet.payer as anchor.web3.Keypair;
  const connection = provider.connection;
  const program = anchor.workspace.nomadzCore as Program<NomadzCore>;

  const userA = Keypair.generate();
  const userB = Keypair.generate();
  const userC = Keypair.generate();

  const userAId = "userA";
  const userBId = "userB";
  const userCId = "userC";

  let configPda: PublicKey;

  before(async () => {
    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId,
    );
    saveAccount("config", configPda.toBase58());
  });

  const initUserAssetData = async (user: Keypair, userId: string) => {
    await connection.requestAirdrop(user.publicKey, 1_000_000_000);
    await new Promise((res) => setTimeout(res, 1000));

    const [userAssetAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_asset_data"),
        Buffer.from(userId),
        program.programId.toBytes(),
      ],
      program.programId,
    );

    const newXP = new anchor.BN(500);
    const newLevel = 10;
    const newLuck = 42;

    await program.methods
      .initializeUserAssetData(userId, newXP, newLevel, newLuck)
      .accounts({
        userAssetData: userAssetAccount,
        user: user.publicKey,
        admin: wallet.publicKey,
        config: configPda,
        nomadzProgram: program.programId,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();

    return userAssetAccount;
  };

  const mintSoulbound = async (
    user: Keypair,
    userId: string,
    remainingAccounts: {
      pubkey: PublicKey;
      isWritable: boolean;
      isSigner: boolean;
    }[] = [],
  ) => {
    const [userAssetAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_asset_data"),
        Buffer.from(userId),
        program.programId.toBytes(),
      ],
      program.programId,
    );

    const [assetAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("soulbound_asset"),
        Buffer.from(userId),
        program.programId.toBytes(),
      ],
      program.programId,
    );

    const [metadataAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBytes(),
        assetAccount.toBytes(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
    );

    const [masterEditionAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBytes(),
        assetAccount.toBytes(),
        Buffer.from("edition"),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
    );

    const [assetAuthority] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("asset_authority"),
        program.programId.toBytes(),
        assetAccount.toBytes(),
      ],
      program.programId,
    );

    const tx = await program.methods
      .mintSoulboundNft({ uri: "ipfs://mock", userId })
      .accounts({
        userAssetData: userAssetAccount,
        assetAccount,
        assetAuthority,
        metadataAccount,
        masterEditionAccount,
        user: user.publicKey,
        admin: wallet.publicKey,
        config: configPda,
        nomadzProgram: program.programId,
        mplCoreProgram: new PublicKey(
          "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
        ),
        mplTokenMetadataProgram: new PublicKey(
          "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
        ),
        tokenProgram: new PublicKey(
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        ),
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .remainingAccounts(remainingAccounts)
      .signers([user])
      .rpc();

    console.log(`Minted for ${userId}`, tx);
  };

  it("User C mints, B gets XP (level 1), A gets nothing", async () => {
    const userAAcc = await initUserAssetData(userA, userAId);
    const userBAcc = await initUserAssetData(userB, userBId);
    const userCAcc = await initUserAssetData(userC, userCId);

    saveAccount("userA", userAAcc.toBase58());
    saveAccount("userB", userBAcc.toBase58());
    saveAccount("userC", userCAcc.toBase58());

    // B is referred by A
    await program.methods
      .applyReferral()
      .accounts({
        userAssetData: userBAcc,
        referrerAssetData: userAAcc,
        authority: wallet.publicKey,
        config: configPda,
      })
      .signers([wallet])
      .rpc();

    // C is referred by B
    await program.methods
      .applyReferral()
      .accounts({
        userAssetData: userCAcc,
        referrerAssetData: userBAcc,
        authority: wallet.publicKey,
        config: configPda,
      })
      .signers([wallet])
      .rpc();

    // Mint NFT only for userC, pass B as remaining (level 1 referrer)
    await mintSoulbound(userC, userCId, [
      {
        pubkey: userBAcc,
        isWritable: true,
        isSigner: false,
      },
    ]);

    const dataA = await program.account.userAssetData.fetch(userAAcc);
    const dataB = await program.account.userAssetData.fetch(userBAcc);
    const dataC = await program.account.userAssetData.fetch(userCAcc);

    console.log(
      "Referral History A:",
      dataA.referralHistory.map((r: any) => ({
        referrer: r.referrer.toBase58(),
        level: r.level,
      })),
    );

    console.log(
      "Referral History B:",
      dataB.referralHistory.map((r: any) => ({
        referrer: r.referrer.toBase58(),
        level: r.level,
      })),
    );

    console.log(
      "Referral History C:",
      dataC.referralHistory.map((r: any) => ({
        referrer: r.referrer.toBase58(),
        level: r.level,
      })),
    );

    console.log("XP A:", dataA.xp.toNumber());
    console.log("XP B:", dataB.xp.toNumber());
    console.log("XP C:", dataC.xp.toNumber());

    assert.strictEqual(dataA.xp.toNumber(), 100);
    assert.strictEqual(dataB.xp.toNumber(), 150);
    assert.strictEqual(dataC.xp.toNumber(), 150);

    assert.strictEqual(dataC.referralHistory.length, 2);
    assert.strictEqual(
      dataC.referralHistory[0].referrer.toBase58(),
      userA.publicKey.toBase58(),
    );
    assert.strictEqual(dataC.referralHistory[0].level, 2);
    assert.strictEqual(
      dataC.referralHistory[1].referrer.toBase58(),
      userB.publicKey.toBase58(),
    );
    assert.strictEqual(dataC.referralHistory[1].level, 1);
  });
});
