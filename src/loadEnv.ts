/** Doit rester le premier import de `index.ts` pour charger `.env` avant les autres modules. */
import dotenv from "dotenv";

dotenv.config();

export {};
