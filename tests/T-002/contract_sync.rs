// tests/T-002/contract_sync.rs
// Pre-written acceptance test for T-002. Do NOT modify this file — make it pass.
//
// Wired via src-tauri/Cargo.toml:
//   [[test]]
//   name = "t002-contract-sync"
//   path = "../tests/T-002/contract_sync.rs"
//
// Run: cargo test --manifest-path src-tauri/Cargo.toml --test t002-contract-sync

use std::path::PathBuf;

fn project_root() -> PathBuf {
    // CARGO_MANIFEST_DIR is src-tauri/; project root is one level up
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri has a parent directory")
        .to_path_buf()
}

#[test]
fn migration_0001_is_byte_identical_to_contract_mirror() {
    let root = project_root();

    let impl_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("migrations")
        .join("0001_init.sql");
    let contract_path = root
        .join("contracts")
        .join("migrations")
        .join("0001_init.sql");

    let impl_bytes = std::fs::read(&impl_path).unwrap_or_else(|e| {
        panic!(
            "cannot read implementation migration at {}: {e}",
            impl_path.display()
        )
    });
    let contract_bytes = std::fs::read(&contract_path).unwrap_or_else(|e| {
        panic!(
            "cannot read contract mirror at {}: {e}",
            contract_path.display()
        )
    });

    assert_eq!(
        impl_bytes, contract_bytes,
        "src-tauri/migrations/0001_init.sql must be a byte-identical copy of \
         contracts/migrations/0001_init.sql. \
         If the contract changed, re-copy it. If the implementation changed, \
         update the contract via an architect session first."
    );
}
