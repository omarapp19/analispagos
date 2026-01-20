import express from 'express';
import { db } from '../firebase.js';

const router = express.Router();

// Get settings
router.get('/', async (req, res) => {
    try {
        const docRef = db.collection('settings').doc('general');
        const doc = await docRef.get();

        if (!doc.exists) {
            const defaultSettings = {
                storeName: 'Mi Negocio',
                adminName: 'Admin',
                updatedAt: new Date()
            };
            await docRef.set(defaultSettings);
            return res.json(defaultSettings);
        }

        res.json(doc.data());
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update settings
router.put('/', async (req, res) => {
    const { storeName, adminName } = req.body;
    try {
        const docRef = db.collection('settings').doc('general');
        const updateData = {
            storeName,
            adminName,
            updatedAt: new Date()
        };

        await docRef.set(updateData, { merge: true }); // Merge ensures we don't overwrite if we add more fields later

        res.json(updateData);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

export default router;

