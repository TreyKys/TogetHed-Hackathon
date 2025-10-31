import React, { useState, useContext, useEffect } from 'react';
import { WalletContext } from '../context/WalletContext';
import { db, collection, query, where, getDocs, limit } from '../firebase';
import { Hbar } from '@hashgraph/sdk';
import './USSDSimulator.css';

const MENU_STATE = {
  IDLE: 'IDLE',
  MAIN: 'MAIN',
  CHECK_BALANCE: 'CHECK_BALANCE',
  CREATE_LISTING_TITLE: 'CREATE_LISTING_TITLE',
  CREATE_LISTING_PRICE: 'CREATE_LISTING_PRICE',
  CREATE_LISTING_DESC: 'CREATE_LISTING_DESC',
  CREATE_LISTING_CONFIRM: 'CREATE_LISTING_CONFIRM',
  CREATE_GIG_TITLE: 'CREATE_GIG_TITLE',
  CREATE_GIG_PRICE: 'CREATE_GIG_PRICE',
  CREATE_GIG_DESC: 'CREATE_GIG_DESC',
  CREATE_GIG_CONFIRM: 'CREATE_GIG_CONFIRM',
  VIEW_MARKETPLACE: 'VIEW_MARKETPLACE',
  VIEW_ITEM: 'VIEW_ITEM',
  BUY_ITEM_CONFIRM: 'BUY_ITEM_CONFIRM',
  SEND_MONEY_ACCOUNT_ID: 'SEND_MONEY_ACCOUNT_ID',
  SEND_MONEY_AMOUNT: 'SEND_MONEY_AMOUNT',
  SEND_MONEY_CONFIRM: 'SEND_MONEY_CONFIRM',
};

const USSDSimulator = () => {
  const { balance, handleMintAndList, handleBuy, accountId } = useContext(WalletContext);

  const [menuState, setMenuState] = useState(MENU_STATE.IDLE);
  const [display, setDisplay] = useState('Dial *467# to start');
  const [input, setInput] = useState('');
  const [smsMessages, setSmsMessages] = useState([]);
  const [sessionData, setSessionData] = useState({});
  const [listings, setListings] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    console.log("USSDSimulator component mounted");
  }, []);

  const MAIN_MENU_TEXT = `Welcome to Integro!
1. Create Listing
2. View Marketplace
3. Create Delivery Gig
4. My HBAR Balance
5. Send Money (mock)`;

  const addSms = (text, sender = 'Integro') => {
    setSmsMessages(prev => [{ sender, text, id: Date.now() }, ...prev]);
  };

  const handleKeyPress = (key) => setInput(prev => prev + key);

  const handleDial = async () => {
    if (menuState === MENU_STATE.IDLE && input === '*467#') {
      setMenuState(MENU_STATE.MAIN);
      setDisplay(MAIN_MENU_TEXT);
    } else {
      await handleMenuState();
    }
    setInput('');
  };

  const handleMenuState = async () => {
     if (input === '0' && menuState !== MENU_STATE.MAIN) {
      setMenuState(MENU_STATE.MAIN);
      setDisplay(MAIN_MENU_TEXT);
      setSessionData({});
      setListings([]);
      return;
    }

    switch (menuState) {
      case MENU_STATE.MAIN:
        handleMainMenu(input);
        break;

      case MENU_STATE.CREATE_LISTING_TITLE:
        setSessionData({ ...sessionData, name: input });
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
        setDisplay(`Confirm Listing:\nTitle: ${listingData.name}\nPrice: ${listingData.price} HBAR\nDesc: ${listingData.description}\n\n1. Confirm\n0. Cancel`);
        break;
      case MENU_STATE.CREATE_LISTING_CONFIRM:
        if (input === '1') {
          setDisplay('Processing your listing...');
          try {
            await handleMintAndList(sessionData);
            addSms(`Congratulations! Your listing "${sessionData.name}" is now live on the marketplace.`);
            setDisplay(`Listing created successfully!\n\nYou will receive an SMS confirmation shortly.\n\n0. Main Menu`);
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

      case MENU_STATE.VIEW_MARKETPLACE:
        handleMarketplaceNavigation(input);
        break;

      case MENU_STATE.BUY_ITEM_CONFIRM:
        if (input === '1') {
          setDisplay('Processing purchase...');
          try {
            await handleBuy(sessionData.selectedItem);
            addSms(`Purchase complete! You bought "${sessionData.selectedItem.name}".\nSeller will be notified.`);
            setDisplay(`Purchase successful!\n\nAn SMS receipt has been sent to you.\n\n0. Main Menu`);
            setMenuState(MENU_STATE.MAIN);
          } catch (error) {
            console.error("Purchase failed:", error);
            setDisplay(`Purchase failed. Please try again.\n\n0. Main Menu`);
            setMenuState(MENU_STATE.MAIN);
          }
        } else {
          setMenuState(MENU_STATE.VIEW_MARKETPLACE);
          setDisplay(formatListings(listings, currentPage));
        }
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
        await fetchAndDisplayListings();
        break;
      case '3':
        setDisplay('Delivery Gig feature coming soon!');
        break;
      case '4':
        const currentBalance = balance ? balance.toString() : 'Loading...';
        setDisplay(`Your HBAR balance is: ${currentBalance}\n\n0. Back`);
        setMenuState(MENU_STATE.CHECK_BALANCE);
        break;
      case '5':
        setMenuState(MENU_STATE.SEND_MONEY_ACCOUNT_ID);
        setDisplay('Enter recipient Account ID:');
        break;
      default:
        setDisplay(`Invalid option.\n${MAIN_MENU_TEXT}`);
    }
  };

  const fetchAndDisplayListings = async () => {
    setDisplay('Fetching marketplace listings...');
    try {
      const q = query(
        collection(db, "listings"),
        where("status", "==", "Listed"),
        where("sellerAccountId", "!=", accountId),
        limit(10)
      );
      const querySnapshot = await getDocs(q);
      const fetchedListings = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (fetchedListings.length === 0) {
        setDisplay('The marketplace is currently empty.\n\n0. Main Menu');
        setMenuState(MENU_STATE.MAIN);
        return;
      }

      setListings(fetchedListings);
      setCurrentPage(0);
      setMenuState(MENU_STATE.VIEW_MARKETPLACE);
      setDisplay(formatListings(fetchedListings, 0));
    } catch (error) {
      console.error("Failed to fetch listings:", error);
      setDisplay("Could not fetch marketplace.\nPlease try again.\n\n0. Main Menu");
      setMenuState(MENU_STATE.MAIN);
    }
  };

  const formatListings = (items, page) => {
    const itemsPerPage = 3;
    const start = page * itemsPerPage;
    const pageItems = items.slice(start, start + itemsPerPage);

    let text = `Marketplace (Page ${page + 1}):\n`;
    pageItems.forEach((item, index) => {
      text += `${start + index + 1}. ${item.name} - ${Hbar.fromTinybars(item.price).toString()}\n`;
    });

    if (items.length > start + itemsPerPage) text += `99. Next Page\n`;
    text += `\nSelect an item or option.\n0. Main Menu`;
    return text;
  };

  const handleMarketplaceNavigation = (navInput) => {
    if (navInput === '99') {
      const nextPage = currentPage + 1;
      if (nextPage * 3 < listings.length) {
        setCurrentPage(nextPage);
        setDisplay(formatListings(listings, nextPage));
      } else {
        setDisplay(`End of listings.\n${formatListings(listings, currentPage)}`);
      }
    } else {
      const itemIndex = parseInt(navInput, 10) - 1;
      if (itemIndex >= 0 && itemIndex < listings.length) {
        setSessionData({ selectedItem: listings[itemIndex] });
        setMenuState(MENU_STATE.BUY_ITEM_CONFIRM);
        const priceHbar = Hbar.fromTinybars(listings[itemIndex].price).toString();
        setDisplay(`Item: ${listings[itemIndex].name}\nPrice: ${priceHbar}\nDesc: ${listings[itemIndex].description}\n\n1. Buy\n0. Back`);
      } else {
        setDisplay(`Invalid selection.\n${formatListings(listings, currentPage)}`);
      }
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
