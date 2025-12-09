import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.send('Hello from Tom\'s TurboVets Assessment!');
});

export default router;