const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// CONFIGURAÇÃO DO NEON DB
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_zdarg4Q0uTUh@ep-sparkling-mouse-a4uq447w-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

// --- ROTA DE LOGIN E REGISTRO ---
app.post('/auth', async (req, res) => {
    const { username, password, coupon, action } = req.body;

    if (coupon !== 'maxhome') {
        return res.status(403).json({ error: 'Cupom inválido! Acesso negado.' });
    }

    try {
        if (action === 'register') {
            await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
            return res.json({ success: true, message: 'Usuário cadastrado!' });
        } else {
            const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
            if (result.rows.length > 0) return res.json({ success: true, user: username });
            else return res.status(401).json({ error: 'Credenciais inválidas' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ROTAS DE CATEGORIAS ---
app.get('/categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories WHERE parent_id IS NULL ORDER BY pinned DESC, created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Divisores de uma categoria específica
app.get('/categories/:parentId/divisors', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM categories WHERE parent_id = $1 ORDER BY created_at DESC', 
            [req.params.parentId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/categories', async (req, res) => {
    const { name, thumb_url, parent_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO categories (name, thumb_url, parent_id) VALUES ($1, $2, $3)', 
            [name, thumb_url, parent_id || null]
        );
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// EDITAR CATEGORIA
app.put('/categories/:id', async (req, res) => {
    const { id } = req.params;
    const { name, thumb_url } = req.body;
    try {
        await pool.query('UPDATE categories SET name = $1, thumb_url = $2 WHERE id = $3', [name, thumb_url, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// FIXAR/DESFIXAR CATEGORIA
app.put('/categories/:id/pin', async (req, res) => {
    const { id } = req.params;
    const { pinned } = req.body;
    try {
        if (pinned) {
            const pinnedCount = await pool.query('SELECT COUNT(*) FROM categories WHERE pinned = true AND parent_id IS NULL');
            if (parseInt(pinnedCount.rows[0].count) >= 3) {
                return res.status(400).json({ error: 'Máximo de 3 categorias fixadas permitido' });
            }
        }
        
        await pool.query('UPDATE categories SET pinned = $1 WHERE id = $2', [pinned, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/categories/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ROTAS DE MATÉRIAS (ARQUIVOS) ---

// Matérias de um divisor específico
app.get('/posts/:categoryId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM posts WHERE category_id = $1 ORDER BY created_at DESC', 
            [req.params.categoryId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao carregar matérias:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// TODAS as matérias (de todas as categorias)
app.get('/posts', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, c.name as categoria_nome, c.thumb_url as categoria_thumb 
            FROM posts p 
            LEFT JOIN categories c ON p.category_id = c.id 
            ORDER BY p.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/posts', async (req, res) => {
    const { category_id, title, author, content, media_urls } = req.body;
    
    try {
        await pool.query(
            'INSERT INTO posts (category_id, title, author, content, media_urls, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
            [category_id, title, author, content, JSON.stringify(media_urls), new Date()]
        );
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

app.delete('/posts/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota para servir o admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Rota padrão
app.get('/', (req, res) => {
    res.json({ 
        message: 'API ZIPNEWS PRO funcionando!',
        endpoints: {
            categories: '/categories',
            divisors: '/categories/:parentId/divisors',
            allPosts: '/posts',
            categoryPosts: '/posts/:categoryId',
            admin: '/admin'
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📊 Admin: http://localhost:${PORT}/admin`);
    console.log(`🌐 API: http://localhost:${PORT}/`);
});