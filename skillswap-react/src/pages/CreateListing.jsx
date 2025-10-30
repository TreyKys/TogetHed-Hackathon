import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import BackButton from '../components/BackButton.jsx';
import './CreateListing.css';

const CreateListing = () => {
    const { handleMintAndList } = useWallet();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('Goods & Produce');
    const [imageUrl, setImageUrl] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !description || !price || !category || !imageUrl) {
            setStatus('Please fill out all fields.');
            return;
        }
        setIsProcessing(true);
        setStatus('Minting and listing your asset...');
        try {
            await handleMintAndList({ name, description, price: parseFloat(price), category, imageUrl });
            setStatus('✅ Asset listed successfully!');
            setTimeout(() => navigate('/marketplace'), 2000);
        } catch (error) {
            console.error('Failed to mint and list:', error);
            setStatus(`❌ Error: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="create-listing-container">
            <BackButton />
            <h2>Create a New Listing</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="name">Product/Service Name</label>
                    <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="price">Price (in HBAR)</label>
                    <input type="number" id="price" value={price} onChange={(e) => setPrice(e.target.value)} required min="0" step="any" />
                </div>
                <div className="form-group">
                    <label htmlFor="category">Category</label>
                    <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="Goods & Produce">Goods & Produce</option>
                        <option value="Services & Gigs">Services & Gigs</option>
                        <option value="Jobs & Requests">Jobs & Requests</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="imageUrl">Image URL</label>
                    <input type="url" id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} required />
                </div>
                <button type="submit" className="submit-button" disabled={isProcessing}>
                    {isProcessing ? 'Processing...' : 'Create Listing'}
                </button>
            </form>
            {status && <p className="status-message">{status}</p>}
        </div>
    );
};

export default CreateListing;
