// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "hardhat/console.sol";

contract LendingPool {
    address public assetTokenAddress;
    address public owner; // pool admin who can withdraw liquidity and liquidate after default

    uint256 public liquidity; // available liquidity (wei units) that admin has deposited and that is not currently loaned

    enum LoanState {
        NONE,
        ACTIVE,
        REPAID,
        LIQUIDATED
    }

    struct Loan {
        address borrower;
        uint256 principal; // wei
        uint256 interest;  // wei (absolute amount, not percentage)
        uint256 dueTime;   // unix timestamp
        uint256 tokenId;
        LoanState state;
    }

    // tokenId (serial) -> Loan
    mapping(uint256 => Loan) public loans;

    event LiquidityDeposited(address indexed who, uint256 amount);
    event LiquidityWithdrawn(address indexed who, uint256 amount);
    event LoanTaken(uint256 indexed tokenId, address indexed borrower, uint256 principal, uint256 interest, uint256 dueTime);
    event LoanRepaid(uint256 indexed tokenId, address indexed borrower, uint256 amount);
    event LoanLiquidated(uint256 indexed tokenId, address indexed liquidator, address to);

    modifier onlyOwner() {
        require(msg.sender == owner, "LendingPool: Only owner");
        _;
    }

    constructor(address _assetTokenAddress) {
        assetTokenAddress = _assetTokenAddress;
        owner = msg.sender;
    }

    // ---------------------------
    // Admin - liquidity management
    // ---------------------------
    // Anyone (admin) can add liquidity by sending HBAR to the contract
    function depositLiquidity() external payable {
        require(msg.value > 0, "LendingPool: deposit > 0");
        liquidity += msg.value;
        emit LiquidityDeposited(msg.sender, msg.value);
    }

    // Withdraw only available liquidity (not locked in active loans)
    function withdrawLiquidity(uint256 amount) external onlyOwner {
        require(amount <= liquidity, "LendingPool: insufficient available liquidity");
        liquidity -= amount;
        (bool sent, ) = payable(owner).call{value: amount}("");
        require(sent, "LendingPool: withdraw failed");
        emit LiquidityWithdrawn(owner, amount);
    }

    // ---------------------------
    // Borrower flow
    // ---------------------------
    // Borrower must first approve the pool contract to take their NFT (via SDK AccountAllowanceApproveTransaction)
    // Then borrower calls takeLoan — the contract will transfer the NFT in, and pay the principal to borrower
    function takeLoan(uint256 tokenId, uint256 principal, uint256 interest, uint256 durationSeconds) external {
        require(loans[tokenId].state == LoanState.NONE, "LendingPool: loan exists for tokenId");
        require(principal > 0, "LendingPool: principal > 0");
        require(durationSeconds > 0 && durationSeconds <= 30 days, "LendingPool: invalid duration");
        require(principal <= liquidity, "LendingPool: insufficient liquidity");

        IERC721 assetToken = IERC721(assetTokenAddress);

        // 1) pull NFT from borrower into contract - requires borrower to have approved pool contract
        assetToken.safeTransferFrom(msg.sender, address(this), tokenId);

        // 2) fund borrower
        liquidity -= principal;
        (bool sent, ) = payable(msg.sender).call{value: principal}("");
        require(sent, "LendingPool: failed to send principal to borrower");

        // 3) create loan record
        uint256 due = block.timestamp + durationSeconds;
        loans[tokenId] = Loan({
            borrower: msg.sender,
            principal: principal,
            interest: interest,
            dueTime: due,
            tokenId: tokenId,
            state: LoanState.ACTIVE
        });

        emit LoanTaken(tokenId, msg.sender, principal, interest, due);
    }

    // Borrower repays principal + interest (exact amount)
    function repayLoan(uint256 tokenId) external payable {
        Loan storage loan = loans[tokenId];
        require(loan.state == LoanState.ACTIVE, "LendingPool: loan not active");
        require(msg.sender == loan.borrower, "LendingPool: only borrower can repay");

        uint256 owed = loan.principal + loan.interest;
        require(msg.value == owed, "LendingPool: incorrect repay amount");

        // mark repaid
        loan.state = LoanState.REPAID;

        // give back NFT to borrower
        IERC721 assetToken = IERC721(assetTokenAddress);
        assetToken.safeTransferFrom(address(this), loan.borrower, tokenId);

        // increase liquidity by the full repay amount (principal + interest)
        liquidity += msg.value;

        emit LoanRepaid(tokenId, loan.borrower, msg.value);
    }

    // ---------------------------
    // Liquidation (admin) after dueTime
    // ---------------------------
    function liquidateLoan(uint256 tokenId, address to) external onlyOwner {
        Loan storage loan = loans[tokenId];
        require(loan.state == LoanState.ACTIVE, "LendingPool: loan not active");
        require(block.timestamp > loan.dueTime, "LendingPool: loan not due");

        loan.state = LoanState.LIQUIDATED;

        // transfer NFT to 'to' (owner or admin account)
        IERC721 assetToken = IERC721(assetTokenAddress);
        assetToken.safeTransferFrom(address(this), to, tokenId);

        emit LoanLiquidated(tokenId, msg.sender, to);
    }

    // ---------------------------
    // Emergency / helper view
    // ---------------------------
    function getLoan(uint256 tokenId) external view returns (address borrower, uint256 principal, uint256 interest, uint256 dueTime, uint256 tid, LoanState state) {
        Loan memory l = loans[tokenId];
        return (l.borrower, l.principal, l.interest, l.dueTime, l.tokenId, l.state);
    }

    // Fallback to accept HBAR
    receive() external payable {
        liquidity += msg.value;
        emit LiquidityDeposited(msg.sender, msg.value);
    }
}
