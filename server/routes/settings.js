import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get settings
router.get('/', async (req, res) => {
    try {
        let settings = await prisma.settings.findFirst();
        if (!settings) {
            settings = await prisma.settings.create({
                data: {
                    storeName: 'Mi Negocio',
                    adminName: 'Admin'
                }
            });
        }
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update settings
router.put('/', async (req, res) => {
    const { storeName, adminName } = req.body;
    try {
        // Always update record with ID 1 since we only have one settings record
        // Check if settings exist
        const count = await prisma.settings.count();
        if (count === 0) {
            await prisma.settings.create({
                data: {
                    id: 1,
                    storeName: storeName || 'Mi Negocio',
                    adminName: adminName || 'Admin'
                }
            });
        }

        const settings = await prisma.settings.update({
            where: { id: 1 },
            data: {
                storeName,
                adminName,
                updatedAt: new Date()
            }
        });
        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

export default router;
