import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.send('Hello from Express + TypeScript!');
});

//TODO: For testing errorHandler, get rid of this before submitting
router.get("/boom", () => {
  throw new Error("boom");
});

export default router;