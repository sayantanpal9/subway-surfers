import express from 'express';
import { health, dayevent, dayload, getDays, getDayEvents, getSummary } from './controllers/index.js';
import { connectdb } from './db/index.js';
import { errMsg } from './utils/apierror.js';
import cors from 'cors';


const app = express();
app.use(cors());
app.use(express.json({limit:'25mb'}));
app.get('/api/v1/health', health);
app.post('/api/v1/day/load', dayload);
app.post('/api/v1/day/events', dayevent);
app.get('/api/v1/days', getDays);
app.get('/api/v1/day/:day_id/summary', getSummary);
app.get('/api/v1/day/:day_id/events', getDayEvents);


app.listen(8080,async () => {
    try {
        await connectdb();
    } catch (err) {
        throw new errMsg(409, 'error connecting db', err);
    }
})