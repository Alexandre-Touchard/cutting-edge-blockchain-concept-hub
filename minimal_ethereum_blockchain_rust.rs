// Cargo.toml dependencies:
// [dependencies]
// sha2 = "0.10"
// serde = { version = "1.0", features = ["derive"] }
// serde_json = "1.0"
// hex = "0.4"

use sha2::{Sha256, Digest};
use serde::{Serialize, Deserialize};
use std::time::{SystemTime, UNIX_EPOCH};

// ============================================================================
// CORE DATA STRUCTURES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub address: String,
    pub balance: u64,
    pub nonce: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub from: String,
    pub to: String,
    pub value: u64,
    pub nonce: u64,
    pub hash: String,
}

impl Transaction {
    pub fn new(from: String, to: String, value: u64, nonce: u64) -> Self {
        let mut tx = Transaction {
            from,
            to,
            value,
            nonce,
            hash: String::new(),
        };
        tx.hash = tx.calculate_hash();
        tx
    }

    fn calculate_hash(&self) -> String {
        let data = format!("{}{}{}{}", self.from, self.to, self.value, self.nonce);
        let mut hasher = Sha256::new();
        hasher.update(data.as_bytes());
        hex::encode(hasher.finalize())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub number: u64,
    pub timestamp: u64,
    pub transactions: Vec<Transaction>,
    pub previous_hash: String,
    pub hash: String,
    pub nonce: u64,
    pub difficulty: u32,
    pub miner: String,
}

impl Block {
    pub fn new(
        number: u64,
        transactions: Vec<Transaction>,
        previous_hash: String,
        difficulty: u32,
        miner: String,
    ) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut block = Block {
            number,
            timestamp,
            transactions,
            previous_hash,
            hash: String::new(),
            nonce: 0,
            difficulty,
            miner,
        };
        
        block.mine();
        block
    }

    fn calculate_hash(&self) -> String {
        let tx_data: String = self.transactions
            .iter()
            .map(|tx| tx.hash.clone())
            .collect::<Vec<_>>()
            .join("");

        let data = format!(
            "{}{}{}{}{}",
            self.number, self.timestamp, tx_data, self.previous_hash, self.nonce
        );

        let mut hasher = Sha256::new();
        hasher.update(data.as_bytes());
        hex::encode(hasher.finalize())
    }

    fn mine(&mut self) {
        let target = "0".repeat(self.difficulty as usize);
        
        loop {
            self.hash = self.calculate_hash();
            if self.hash.starts_with(&target) {
                break;
            }
            self.nonce += 1;
        }
    }

    pub fn validate(&self) -> bool {
        let target = "0".repeat(self.difficulty as usize);
        self.hash.starts_with(&target) && self.hash == self.calculate_hash()
    }
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldState {
    accounts: std::collections::HashMap<String, Account>,
}

impl WorldState {
    pub fn new() -> Self {
        WorldState {
            accounts: std::collections::HashMap::new(),
        }
    }

    pub fn get_account(&self, address: &str) -> Option<&Account> {
        self.accounts.get(address)
    }

    pub fn create_account(&mut self, address: String, balance: u64) {
        self.accounts.insert(
            address.clone(),
            Account {
                address,
                balance,
                nonce: 0,
            },
        );
    }

    pub fn transfer(&mut self, from: &str, to: &str, value: u64) -> Result<(), String> {
        // Check sender exists and has enough balance
        let sender_balance = self.accounts
            .get(from)
            .ok_or("Sender account not found")?
            .balance;

        if sender_balance < value {
            return Err("Insufficient balance".to_string());
        }

        // Update sender
        if let Some(sender) = self.accounts.get_mut(from) {
            sender.balance -= value;
            sender.nonce += 1;
        }

        // Create receiver if doesn't exist
        if !self.accounts.contains_key(to) {
            self.create_account(to.to_string(), 0);
        }

        // Update receiver
        if let Some(receiver) = self.accounts.get_mut(to) {
            receiver.balance += value;
        }

        Ok(())
    }

    pub fn get_balance(&self, address: &str) -> u64 {
        self.accounts
            .get(address)
            .map(|acc| acc.balance)
            .unwrap_or(0)
    }

    pub fn get_nonce(&self, address: &str) -> u64 {
        self.accounts
            .get(address)
            .map(|acc| acc.nonce)
            .unwrap_or(0)
    }

    pub fn all_accounts(&self) -> Vec<Account> {
        self.accounts.values().cloned().collect()
    }
}

// ============================================================================
// BLOCKCHAIN
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct Blockchain {
    pub chain: Vec<Block>,
    pub pending_transactions: Vec<Transaction>,
    pub state: WorldState,
    pub difficulty: u32,
}

impl Blockchain {
    pub fn new(difficulty: u32) -> Self {
        let mut blockchain = Blockchain {
            chain: Vec::new(),
            pending_transactions: Vec::new(),
            state: WorldState::new(),
            difficulty,
        };

        // Create genesis block
        blockchain.create_genesis_block();
        blockchain
    }

    fn create_genesis_block(&mut self) {
        let genesis = Block::new(
            0,
            vec![],
            "0".to_string(),
            self.difficulty,
            "genesis".to_string(),
        );
        self.chain.push(genesis);

        // Create initial accounts
        self.state.create_account("Alice".to_string(), 1000);
        self.state.create_account("Bob".to_string(), 1000);
        self.state.create_account("Charlie".to_string(), 1000);
    }

    pub fn add_transaction(&mut self, from: String, to: String, value: u64) -> Result<String, String> {
        // Validate sender has enough balance
        let balance = self.state.get_balance(&from);
        if balance < value {
            return Err(format!("Insufficient balance. Has: {}, Needs: {}", balance, value));
        }

        let nonce = self.state.get_nonce(&from);
        let tx = Transaction::new(from, to, value, nonce);
        let hash = tx.hash.clone();
        
        self.pending_transactions.push(tx);
        Ok(hash)
    }

    pub fn mine_pending_transactions(&mut self, miner: String) -> Result<Block, String> {
        if self.pending_transactions.is_empty() {
            return Err("No transactions to mine".to_string());
        }

        let previous_hash = self.chain.last().unwrap().hash.clone();
        let block_number = self.chain.len() as u64;

        // Execute transactions and update state
        let mut valid_transactions = Vec::new();
        
        for tx in self.pending_transactions.drain(..) {
            match self.state.transfer(&tx.from, &tx.to, tx.value) {
                Ok(_) => valid_transactions.push(tx),
                Err(e) => println!("Transaction failed: {}", e),
            }
        }

        if valid_transactions.is_empty() {
            return Err("All transactions failed validation".to_string());
        }

        // Create and mine the block
        let block = Block::new(
            block_number,
            valid_transactions,
            previous_hash,
            self.difficulty,
            miner,
        );

        self.chain.push(block.clone());
        Ok(block)
    }

    pub fn validate_chain(&self) -> bool {
        for i in 1..self.chain.len() {
            let current_block = &self.chain[i];
            let previous_block = &self.chain[i - 1];

            // Validate block hash
            if !current_block.validate() {
                return false;
            }

            // Validate chain linkage
            if current_block.previous_hash != previous_block.hash {
                return false;
            }
        }
        true
    }

    pub fn get_block(&self, number: u64) -> Option<&Block> {
        self.chain.get(number as usize)
    }

    pub fn get_chain_length(&self) -> usize {
        self.chain.len()
    }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

fn main() {
    println!("🔗 Minimal Ethereum Blockchain in Rust\n");

    // Create blockchain with difficulty 2 (2 leading zeros)
    let mut blockchain = Blockchain::new(2);

    println!("📊 Initial State:");
    for account in blockchain.state.all_accounts() {
        println!("  {} - Balance: {} ETH", account.address, account.balance);
    }
    println!();

    // Add transactions
    println!("📝 Adding Transactions:");
    match blockchain.add_transaction("Alice".to_string(), "Bob".to_string(), 100) {
        Ok(hash) => println!("  ✓ Transaction added: {}...", &hash[..16]),
        Err(e) => println!("  ✗ Failed: {}", e),
    }

    match blockchain.add_transaction("Bob".to_string(), "Charlie".to_string(), 50) {
        Ok(hash) => println!("  ✓ Transaction added: {}...", &hash[..16]),
        Err(e) => println!("  ✗ Failed: {}", e),
    }
    println!();

    // Mine block
    println!("⛏️  Mining Block 1...");
    match blockchain.mine_pending_transactions("Miner1".to_string()) {
        Ok(block) => {
            println!("  ✓ Block mined!");
            println!("  Block #{}", block.number);
            println!("  Hash: {}...", &block.hash[..16]);
            println!("  Nonce: {}", block.nonce);
            println!("  Transactions: {}", block.transactions.len());
        }
        Err(e) => println!("  ✗ Mining failed: {}", e),
    }
    println!();

    // Check balances
    println!("💰 Final State:");
    for account in blockchain.state.all_accounts() {
        println!("  {} - Balance: {} ETH", account.address, account.balance);
    }
    println!();

    // Validate chain
    println!("🔍 Chain Validation:");
    if blockchain.validate_chain() {
        println!("  ✓ Blockchain is valid!");
    } else {
        println!("  ✗ Blockchain is invalid!");
    }

    println!("\n📈 Chain Stats:");
    println!("  Total Blocks: {}", blockchain.get_chain_length());
    println!("  Difficulty: {}", blockchain.difficulty);
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transaction_creation() {
        let tx = Transaction::new("Alice".to_string(), "Bob".to_string(), 100, 0);
        assert_eq!(tx.from, "Alice");
        assert_eq!(tx.to, "Bob");
        assert_eq!(tx.value, 100);
        assert!(!tx.hash.is_empty());
    }

    #[test]
    fn test_block_mining() {
        let tx = Transaction::new("Alice".to_string(), "Bob".to_string(), 100, 0);
        let block = Block::new(1, vec![tx], "previous_hash".to_string(), 2, "miner".to_string());
        
        assert!(block.hash.starts_with("00"));
        assert!(block.validate());
    }

    #[test]
    fn test_state_transfer() {
        let mut state = WorldState::new();
        state.create_account("Alice".to_string(), 1000);
        state.create_account("Bob".to_string(), 500);

        assert!(state.transfer("Alice", "Bob", 200).is_ok());
        assert_eq!(state.get_balance("Alice"), 800);
        assert_eq!(state.get_balance("Bob"), 700);
    }

    #[test]
    fn test_insufficient_balance() {
        let mut state = WorldState::new();
        state.create_account("Alice".to_string(), 100);

        assert!(state.transfer("Alice", "Bob", 200).is_err());
    }

    #[test]
    fn test_blockchain_validation() {
        let mut blockchain = Blockchain::new(2);
        blockchain.add_transaction("Alice".to_string(), "Bob".to_string(), 100).unwrap();
        blockchain.mine_pending_transactions("Miner1".to_string()).unwrap();

        assert!(blockchain.validate_chain());
    }
}
