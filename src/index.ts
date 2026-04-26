import 'dotenv/config';
import { app } from './app';

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
    // eslint-disable-next-line no-console -- startup message, intentional
    console.log(`Server running at http://localhost:${PORT}`);
    // eslint-disable-next-line no-console -- startup message, intentional
    console.log(`API docs at http://localhost:${PORT}/api-docs`);
});

// : )