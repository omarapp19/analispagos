import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import transactionsRoutes from './routes/transactions.js';
import billsRoutes from './routes/bills.js';
import settingsRoutes from './routes/settings.js';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/transactions', transactionsRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/settings', settingsRoutes);

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Handle Shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});
