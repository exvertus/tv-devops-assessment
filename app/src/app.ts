import express from 'express';
import dotenv from 'dotenv';
import { requestTimer } from "./middleware/requestTimer";
import { logger } from "./middleware/logger";
import indexRoutes from './routes';
import healthRoutes from "./routes/health";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config();

const app = express();

// Add health before middleware to avoid log spam.
app.use('/health', healthRoutes);

app.use(requestTimer);
app.use(express.json());
app.use(logger);

app.use('/', indexRoutes);

app.use(errorHandler);

export default app;