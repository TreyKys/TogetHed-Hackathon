import React, { useState, useContext, useEffect } from 'react';
import { WalletContext } from '../context/WalletContext';
import { db, collection, query, where, getDocs, limit } from '../firebase';
import { Hbar } from '@hashgraph/sdk';
import './USSDSimulator.css';

const MENU_STATE = {
  IDLE: 'IDLE',
  ONBOARDING: 'ONBOARDING',
  MAIN: 'MAIN',
  CHECK_BALANCE: 'CHECK_BALANCE',
  CREATE_LISTING_TITLE: 'CREATE_LISTING_TITLE',
  CREATE_LISTING_QUALITY: 'CREATE_LISTING_QUALITY',
  CREATE_LISTING_PRICE: 'CREATE_LISTING_PRICE',
  CREATE_LISTING_DESC: 'CREATE_LISTING_DESC',
  CREATE_LISTING_CONFIRM: 'CREATE_LISTING_CONFIRM',
  VIEW_MARKETPLACE: 'VIEW_MARKETPLACE',
  BUY_ITEM_CONFIRM: 'BUY_ITEM_CONFIRM',
  SEND_MONEY_ACCOUNT_ID: 'SEND_MONEY_ACCOUNT_ID',
  SEND_MONEY_AMOUNT: 'SEND_MONEY_AMOUNT',
  SEND_MONEY_CONFIRM: 'SEND_MONEY_CONFIRM',
};

const USSDSimulator = () => {
  const { balance, handleMintAndList, handleBuy, accountId, createVault } = useContext(WalletContext);

  const [menuState, setMenuState] = useState(MENU_STATE.IDLE);
  const [display, setDisplay] = useState('Dial *467# to start');
  const [input, setInput] = useState('');
  const [smsMessages, setSmsMessages] = useState([]);
  const [sessionData, setSessionData] = useState({});

  const MAIN_MENU_TEXT = `Welcome to Integro!
1. Create Listing
2. View Marketplace
3. My HBAR Balance
4. Send Money (mock)`;

  const addSms = (text, sender = 'Integro') => {
    setSmsMessages(prev => [{ sender, text, id: Date.now() }, ...prev]);
  };

  const handleKeyPress = (key) => setInput(prev => prev + key);

  const handleDial = async () => {
    if (menuState === MENU_STATE.IDLE && input === '*467#') {
      if (!accountId) {
        setMenuState(MENU_STATE.ONBOARDING);
        setDisplay('Welcome to Integro!\n\nTo use our service, you need a secure digital vault. Create one now?\n\n1. Yes, create my vault\n2. No, not now');
      } else {
        setMenuState(MENU_STATE.MAIN);
        setDisplay(MAIN_MENU_TEXT);
      }
    } else {
      await handleMenuState();
    }
    setInput('');
  };

  const handleMenuState = async () => {
     if (input === '0' && menuState !== MENU_STATE.MAIN && menuState !== MENU_STATE.IDLE) {
      setMenuState(MENU_STATE.MAIN);
      setDisplay(MAIN_MENU_TEXT);
      setSessionData({});
      return;
    }

    switch (menuState) {
      case MENU_STATE.ONBOARDING:
        if (input === '1') {
          setDisplay('Creating your secure vault...');
          try {
            const response = await fetch("https://createaccount-cehqwvb4aq-uc.a.run.app", { method: 'POST' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create vault.');

            createVault(data.accountId, data.privateKey, data.evmAddress);

            setDisplay(`Vault created successfully!\n\nDial *467# again to access the main menu.`);
            addSms(`Your Integro Vault Details:\nAccount ID: ${data.accountId}\nPrivate Key: ${data.privateKey}\n\nKEEP THIS SECRET. DO NOT SHARE.`);
            setMenuState(MENU_STATE.IDLE);
          } catch (error) {
            console.error("Onboarding failed:", error);
            setDisplay(`Vault creation failed. Please try again later.\n\nDial *467# to retry.`);
            setMenuState(MENU_STATE.IDLE);
          }
        } else {
          setDisplay('Action cancelled. Dial *467# to start again.');
          setMenuState(MENU_STATE.IDLE);
        }
        break;

      case MENU_STATE.MAIN:
        handleMainMenu(input);
        break;

      case MENU_STATE.CREATE_LISTING_TITLE:
        setSessionData({ ...sessionData, name: input });
        setMenuState(MENU_STATE.CREATE_LISTING_QUALITY);
        setDisplay('Select Quality:\nA. Grade A (Best)\nB. Grade B (Good)\nC. Grade C (Fair)');
        break;

      case MENU_STATE.CREATE_LISTING_QUALITY:
        let quality;
        if (input.toUpperCase() === 'A') quality = 'A';
        else if (input.toUpperCase() === 'B') quality = 'B';
        else if (input.toUpperCase() === 'C') quality = 'C';
        else {
          setDisplay('Invalid selection. Please choose A, B, or C.\n\nSelect Quality:\nA. Grade A (Best)\nB. Grade B (Good)\nC. Grade C (Fair)');
          break;
        }
        setSessionData({ ...sessionData, quality: quality });
        setMenuState(MENU_STATE.CREATE_LISTING_PRICE);
        setDisplay('Enter item price (in HBAR):');
        break;

      case MENU_STATE.CREATE_LISTING_PRICE:
        setSessionData({ ...sessionData, price: input });
        setMenuState(MENU_STATE.CREATE_LISTING_DESC);
        setDisplay('Enter item description:');
        break;
      case MENU_STATE.CREATE_LISTING_DESC:
        const listingData = { ...sessionData, description: input };
        setSessionData(listingData);
        setMenuState(MENU_STATE.CREATE_LISTING_CONFIRM);
        setDisplay(`Confirm Listing:\nTitle: ${listingData.name}\nQuality: Grade ${listingData.quality}\nPrice: ${listingData.price} HBAR\nDesc: ${listingData.description}\n\n1. Confirm\n0. Cancel`);
        break;
      case MENU_STATE.CREATE_LISTING_CONFIRM:
        if (input === '1') {
          setDisplay('Processing your listing...');
          try {
            const finalListingData = {
              ...sessionData,
              category: 'Goods',
              imageUrl: 'https://via.placeholder.com/150',
            };
            await handleMintAndList(finalListingData);
            addSms(`Your listing "${sessionData.name}" has been minted and listed successfully (pending agent verification).`);
            setDisplay(`Listed and minted successfully! (pending agent verification)\n\nYou will receive an SMS confirmation shortly.\n\n0. Main Menu`);
          } catch (error) {
            console.error("Failed to create listing:", error);
            setDisplay(`Listing failed. Please try again.\n\n0. Main Menu`);
            addSms(`We're sorry, but your listing "${sessionData.name}" could not be created at this time.`);
          }
        } else {
          setDisplay(`Listing cancelled.\n${MAIN_MENU_TEXT}`);
        }
        setMenuState(MENU_STATE.MAIN);
        setSessionData({});
        break;

      case MENU_STATE.BUY_ITEM_CONFIRM:
        if (input === '1') {
          setDisplay('Processing purchase...');
          try {
            await handleBuy(sessionData.selectedItem);
            addSms(`Purchase complete! You bought "${sessionData.selectedItem.name}".\nSeller will be notified.`);
            setDisplay(`Purchase successful!\n\nAn SMS receipt has been sent to you.\n\n0. Main Menu`);
          } catch (error) {
            console.error("Purchase failed:", error);
            setDisplay(`Purchase failed. Please try again.\n\n0. Main Menu`);
          }
        } else {
          setDisplay('Purchase cancelled.');
        }
        setMenuState(MENU_STATE.MAIN);
        break;

      case MENU_STATE.CHECK_BALANCE:
         if (input === '0') {
          setMenuState(MENU_STATE.MAIN);
          setDisplay(MAIN_MENU_TEXT);
        } else {
          setDisplay(`Invalid option.\nYour HBAR balance is: ${balance.toString()}\n\n0. Back`);
        }
        break;

      case MENU_STATE.SEND_MONEY_ACCOUNT_ID:
        setSessionData({ ...sessionData, recipientId: input });
        setMenuState(MENU_STATE.SEND_MONEY_AMOUNT);
        setDisplay('Enter amount (in HBAR):');
        break;
      case MENU_STATE.SEND_MONEY_AMOUNT:
        setSessionData({ ...sessionData, amount: input });
        setMenuState(MENU_STATE.SEND_MONEY_CONFIRM);
        setDisplay(`Send ${sessionData.amount} HBAR to ${sessionData.recipientId}?\n1. Confirm\n0. Cancel`);
        break;
      case MENU_STATE.SEND_MONEY_CONFIRM:
        if (input === '1') {
          setDisplay('Sending money...');
          setTimeout(() => {
            addSms(`You have sent ${sessionData.amount} HBAR to account ${sessionData.recipientId}.`);
            setDisplay(`Transaction successful!\nAn SMS confirmation has been sent.\n\n0. Main Menu`);
            setMenuState(MENU_STATE.MAIN);
          }, 1500);
        } else {
          setDisplay(`Send money cancelled.\n${MAIN_MENU_TEXT}`);
          setMenuState(MENU_STATE.MAIN);
        }
        setSessionData({});
        break;

      default:
        setMenuState(MENU_STATE.MAIN);
        setDisplay(MAIN_MENU_TEXT);
        break;
    }
  };

  const handleMainMenu = async (choice) => {
    switch (choice) {
      case '1':
        setMenuState(MENU_STATE.CREATE_LISTING_TITLE);
        setDisplay('Enter item title:');
        break;
      case '2':
        setDisplay('Fetching marketplace listings...');
        try {
          const q = query(
            collection(db, "listings"),
            where("status", "==", "Listed"),
            limit(20)
          );
          const querySnapshot = await getDocs(q);
          const fetchedListings = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          if (fetchedListings.length === 0) {
            addSms('The marketplace is currently empty.');
          } else {
            let smsText = 'INTEGRO MARKETPLACE:\n';
            fetchedListings.forEach(item => {
              smsText += `- ${item.name} | ${Hbar.fromTinybars(item.price).toString()}\n`;
            });
            addSms(smsText);
          }
          setDisplay('Latest marketplace listings have been sent to you via SMS.\n\n0. Main Menu');
          setMenuState(MENU_STATE.MAIN);
        } catch (error) {
          console.error("Failed to fetch listings for SMS:", error);
          setDisplay("Could not fetch marketplace.\nPlease try again.\n\n0. Main Menu");
          setMenuState(MENU_STATE.MAIN);
        }
        break;
      case '3':
        const currentBalance = balance ? balance.toString() : 'Loading...';
        setDisplay(`Your HBAR balance is: ${currentBalance}\n\n0. Back`);
        setMenuState(MENU_STATE.CHECK_BALANCE);
        break;
      case '4':
        setMenuState(MENU_STATE.SEND_MONEY_ACCOUNT_ID);
        setDisplay('Enter recipient Account ID:');
        break;
      default:
        setDisplay(`Invalid option.\n${MAIN_MENU_TEXT}`);
    }
  };

  const handleClear = () => {
    setInput('');
    setMenuState(MENU_STATE.IDLE);
    setDisplay('Dial *467# to start');
    setSessionData({});
    setListings([]);
    setCurrentPage(0);
  };

  const renderSmsMessages = () => {
    return smsMessages.length > 0 ? smsMessages.map((msg, index) => (
      <div key={index} className="sms-message">
        <p className="sms-sender">{msg.sender}</p>
        <p>{msg.text}</p>
      </div>
    )).reverse() : <p>No new messages.</p>;
  };

  return (
    <div className="ussd-simulator-container">
      <div className="phone-simulator">
        <div className="phone-screen">
          <div className="ussd-input-display">{input || ' '}</div>
          <pre className="ussd-display">{display}</pre>
        </div>
        <div className="phone-keypad">
           {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
            <button key={key} onClick={() => handleKeyPress(key)}><span>{key}</span></button>
          ))}
        </div>
        <div className="phone-controls">
            <button className="control-btn call" onClick={handleDial}>Dial</button>
            <button className="control-btn clear" onClick={handleClear}>Clear</button>
        </div>
      </div>
      <div className="sms-inbox">
        <h3>SMS Inbox</h3>
        <div className="sms-messages">
          {renderSmsMessages()}
        </div>
      </div>
    </div>
  );
};

export default USSDSimulator;
