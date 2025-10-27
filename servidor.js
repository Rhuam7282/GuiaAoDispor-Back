import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Configuração do dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Importar todos os modelos
import Localizacao from "./modelos/localizacao.js";
import Profissional from "./modelos/profissional.js";
import Usuario from "./modelos/usuario.js";
import Avaliacao from "./modelos/avaliacao.js"; //ainda não usado
import HCurricular from "./modelos/histcurricular.js";
import HProfissional from "./modelos/histprofissional.js";

const app = express();

// ========== SERVIÇO DE ARQUIVOS ESTÁTICOS PARA PRODUÇÃO ==========
// Este middleware deve vir ANTES das rotas de API
app.use(express.static(path.join(__dirname, "../client/dist")));

// Configuração CORS melhorada
app.use(
  cors({
    origin: function (origin, callback) {
      // Permite todas as origens em desenvolvimento
      if (!origin || process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        // Em produção, permite apenas origens específicas
        const allowedOrigins = [
          "https://guiaaodispor.vercel.app",
          "https://guiaaodispor.onrender.com",
        ];
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Origin",
      "X-Requested-With",
      "Accept",
    ],
  })
);

app.options("*", cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ========== CONFIGURAÇÃO DO MULTER PARA UPLOAD DE IMAGENS ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const extensao = path.extname(file.originalname);
    const nomeBase = path.basename(file.originalname, extensao);
    const nomeSanitizado = nomeBase.replace(/[^a-zA-Z0-9]/g, '_');
    const nomeArquivo = `${nomeSanitizado}_${timestamp}${extensao}`;
    cb(null, nomeArquivo);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = /jpeg|jpg|png|webp|gif/;
    const extname = tiposPermitidos.test(path.extname(file.originalname).toLowerCase());
    const mimetype = tiposPermitidos.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (JPEG, JPG, PNG, WebP, GIF)'));
    }
  }
});

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conexão com MongoDB
const mongoURI =
  process.env.MONGO_URI || "mongodb://localhost:27017/guiaaodispor";
console.log("🔗 Tentando conectar ao MongoDB...");

mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ Conexão com o MongoDB estabelecida!"))
  .catch((err) => {
    console.error("❌ Erro ao conectar com o MongoDB:", err);
  });

// Middleware de logging APRIMORADO
app.use((req, res, next) => {
  console.log(
    `🌐 ${req.method} ${req.path}`,
    req.body ? JSON.stringify(req.body).substring(0, 200) : ""
  );
  next();
});

// ========== ROTAS PÚBLICAS ==========

app.get("/", (req, res) => {
  res.json({
    message: "Bem-vindo à API do Guia ao Dispor!",
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1 ? "Conectado" : "Desconectado",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1 ? "Conectado" : "Desconectado",
  });
});

// ========== ROTA PÚBLICA PARA PROFISSIONAIS ==========

app.get("/api/profissionais", async (req, res) => {
  try {
    console.log("🔍 Buscando profissionais...");

    // Primeiro, tenta buscar do MongoDB
    let profissionais = [];

    // Verifica se há profissionais no banco
    const count = await Profissional.countDocuments();
    console.log(`📊 Profissionais no banco: ${count}`);

    if (count > 0) {
      // Busca profissionais reais
      profissionais = await Profissional.find({})
        .populate("localizacao")
        .select("-senha")
        .lean();

      console.log(
        `✅ Encontrados ${profissionais.length} profissionais no banco`
      );
    } else {
      // Se não há profissionais, cria alguns de exemplo
      console.log("📝 Criando profissionais de exemplo...");

      // Cria localização exemplo
      const localizacao = await Localizacao.create({
        nome: "São Paulo",
        cidade: "São Paulo",
        estado: "SP",
      });

      // Cria profissionais exemplo
      await Profissional.create([
        {
          nome: "Maria Silva",
          desc: "10 anos de experiência em enfermagem geriátrica",
          email: "maria@exemplo.com",
          senha: await bcrypt.hash("senha123", 10),
          localizacao: localizacao._id,
        },
        {
          nome: "João Santos",
          desc: "5 anos como cuidador de idosos",
          email: "joao@exemplo.com",
          senha: await bcrypt.hash("senha123", 10),
          localizacao: localizacao._id,
        },
      ]);

      // Busca os profissionais criados
      profissionais = await Profissional.find({})
        .populate("localizacao")
        .select("-senha")
        .lean();
    }

    // Formata os dados
    const profissionaisFormatados = profissionais.map((prof) => {
      return {
        _id: prof._id,
        imagem: prof.foto || "/imagens/mulher.png",
        nome: prof.nome || "Nome não informado",
        localizacao: prof.localizacao
          ? `${prof.localizacao.nome || ""} ${prof.localizacao.cidade || ""} ${
              prof.localizacao.estado || ""
            }`.trim()
          : "Local não informado",
        experiencia: prof.desc || "Experiência não informada",
      };
    });

    res.status(200).json(profissionaisFormatados);
  } catch (error) {
    console.error("❌ Erro ao buscar profissionais:", error);

    // Fallback: retorna dados mock em caso de erro
    const profissionaisMock = [
      {
        _id: "1",
        imagem: "/imagens/mulher.png",
        nome: "Ana Silva",
        localizacao: "São Paulo, SP",
        experiencia: "Enfermeira com 5 anos de experiência",
      },
      {
        _id: "2",
        imagem: "/imagens/homem.png",
        nome: "Carlos Santos",
        localizacao: "Rio de Janeiro, RJ",
        experiencia: "Cuidador especializado",
      },
    ];

    res.status(200).json(profissionaisMock);
  }
});

// GET - Buscar profissional por ID
app.get('/api/profissionais/:id', async (req, res) => {
  try {
    console.log(`👨‍💼 Buscando profissional: ${req.params.id}`);
    const profissional = await Profissional.findById(req.params.id)
      .select('-senha')
      .populate('localizacao');
    
    if (!profissional) {
      return res.status(404).json({
        status: 'erro',
        message: 'Profissional não encontrado'
      });
    }

    res.status(200).json({
      status: 'sucesso',
      data: profissional
    });
  } catch (error) {
    console.error('❌ Erro ao buscar profissional:', error);
    res.status(500).json({
      status: 'erro',
      message: error.message
    });
  }
});

// ========== ROTAS DE AUTENTICAÇÃO (PÚBLICAS) ==========

// Rota para validar email
app.post("/api/auth/validar-email", async (req, res) => {
  try {
    console.log("📧 Validando email:", req.body.email);
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: "erro",
        message: "Email é obrigatório",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: "erro",
        message: "Formato de email inválido",
      });
    }

    const usuarioExistente = await Usuario.findOne({ email });
    const profissionalExistente = await Profissional.findOne({ email });

    if (usuarioExistente || profissionalExistente) {
      return res.status(200).json({
        status: "sucesso",
        valido: false,
        message: "Email já está em uso",
      });
    }

    res.status(200).json({
      status: "sucesso",
      valido: true,
      message: "Email disponível",
    });
  } catch (error) {
    console.error("❌ Erro ao validar email:", error);
    res.status(500).json({
      status: "erro",
      message: error.message,
    });
  }
});

// Rota de Login - CORRIGIDA
app.post("/api/auth/login", async (req, res) => {
  try {
    console.log("🔐 Tentativa de login:", req.body.email);
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        status: "erro",
        message: "Email e senha são obrigatórios",
      });
    }

    // Buscar usuário por email - CORREÇÃO: usar await e tratar erros
    const usuario = await Usuario.findOne({ email })
      .populate("localizacao")
      .catch((err) => {
        console.error("❌ Erro ao buscar usuário:", err);
        return null;
      });

    if (usuario) {
      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      if (senhaValida) {
        const token = jwt.sign(
          {
            _id: usuario._id,
            email: usuario.email,
            tipo: "usuario",
          },
          process.env.JWT_SECRET || "7282",
          { expiresIn: "7d" }
        );

        const usuarioResposta = usuario.toObject();
        delete usuarioResposta.senha;

        console.log("✅ Login usuário bem-sucedido:", usuario.email);

        return res.status(200).json({
          status: "sucesso",
          data: usuarioResposta,
          token,
          message: "Login realizado com sucesso",
        });
      }
    }

    // Se não encontrou usuário ou senha inválida, buscar profissional
    console.log("🔍 Buscando profissional...");
    const profissional = await Profissional.findOne({ email })
      .populate("localizacao")
      .catch((err) => {
        console.error("❌ Erro ao buscar profissional:", err);
        return null;
      });

    if (profissional) {
      const senhaValida = await bcrypt.compare(senha, profissional.senha);
      if (senhaValida) {
        const token = jwt.sign(
          {
            _id: profissional._id,
            email: profissional.email,
            tipo: "profissional",
          },
          process.env.JWT_SECRET || "7282",
          { expiresIn: "7d" }
        );

        const profissionalResposta = profissional.toObject();
        delete profissionalResposta.senha;

        console.log("✅ Login profissional bem-sucedido:", profissional.email);

        return res.status(200).json({
          status: "sucesso",
          data: profissionalResposta,
          token,
          message: "Login realizado com sucesso",
        });
      }
    }

    console.log("❌ Credenciais inválidas para:", email);
    return res.status(401).json({
      status: "erro",
      message: "Credenciais inválidas",
    });
  } catch (error) {
    console.error("❌ Erro no login:", error);
    res.status(500).json({
      status: "erro",
      message: "Erro interno do servidor",
    });
  }
});

// Rota de Logout
app.post("/api/auth/logout", (req, res) => {
  try {
    console.log("🚪 Usuário fez logout");
    res.status(200).json({
      status: "sucesso",
      message: "Logout realizado com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro no logout:", error);
    res.status(500).json({
      status: "erro",
      message: error.message,
    });
  }
});

// ========== ROTAS DE CRIAÇÃO (PÚBLICAS) ==========

app.post("/api/usuarios", async (req, res) => {
  try {
    console.log("👤 Criando novo usuário:", req.body.email);
    const { email, senha, ...outrosDados } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: "erro",
        message: "Formato de email inválido",
      });
    }

    if (!senha || senha.length < 8) {
      return res.status(400).json({
        status: "erro",
        message: "A senha deve ter pelo menos 8 caracteres",
      });
    }

    const usuarioExistente = await Usuario.findOne({ email });
    const profissionalExistente = await Profissional.findOne({ email });

    if (usuarioExistente || profissionalExistente) {
      return res.status(400).json({
        status: "erro",
        message: "Email já está em uso",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const novoUsuario = await Usuario.create({
      ...outrosDados,
      email,
      senha: senhaHash,
    });

    // Gerar token JWT após registro
    const token = jwt.sign(
      {
        _id: novoUsuario._id,
        email: novoUsuario.email,
        tipo: "usuario",
      },
      process.env.JWT_SECRET || "7282",
      { expiresIn: "7d" }
    );

    const usuarioResposta = novoUsuario.toObject();
    delete usuarioResposta.senha;

    console.log("✅ Usuário criado com sucesso:", novoUsuario.email);

    res.status(201).json({
      status: "sucesso",
      data: usuarioResposta,
      token,
      message: "Usuário registrado com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao criar usuário:", error);
    res.status(400).json({
      status: "erro",
      message: error.message,
    });
  }
});

app.post("/api/profissionais", async (req, res) => {
  try {
    console.log("👨‍💼 Criando novo profissional:", req.body.email);
    const { email, senha, ...outrosDados } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: "erro",
        message: "Formato de email inválido",
      });
    }

    if (!senha || senha.length < 8) {
      return res.status(400).json({
        status: "erro",
        message: "A senha deve ter pelo menos 8 caracteres",
      });
    }

    const usuarioExistente = await Usuario.findOne({ email });
    const profissionalExistente = await Profissional.findOne({ email });

    if (usuarioExistente || profissionalExistente) {
      return res.status(400).json({
        status: "erro",
        message: "Email já está em uso",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const novoProfissional = await Profissional.create({
      ...outrosDados,
      email,
      senha: senhaHash,
    });

    // Gerar token JWT após registro
    const token = jwt.sign(
      {
        _id: novoProfissional._id,
        email: novoProfissional.email,
        tipo: "profissional",
      },
      process.env.JWT_SECRET || "7282",
      { expiresIn: "7d" }
    );

    const profissionalResposta = novoProfissional.toObject();
    delete profissionalResposta.senha;

    console.log("✅ Profissional criado com sucesso:", novoProfissional.email);

    res.status(201).json({
      status: "sucesso",
      data: profissionalResposta,
      token,
      message: "Profissional registrado com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao criar profissional:", error);
    res.status(400).json({
      status: "erro",
      message: error.message,
    });
  }
});

// GET - Buscar todos os históricos curriculares
app.get("/api/hcurriculares", async (req, res) => {
  try {
    console.log("📚 Buscando todos os históricos curriculares");

    const { profissional } = req.query;
    let filtro = {};

    if (profissional) {
      filtro.profissional = profissional;
    }

    const historicos = await HCurricular.find(filtro).populate("profissional");

    res.status(200).json({
      status: "sucesso",
      data: historicos,
      total: historicos.length,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar históricos curriculares:", error);
    res.status(500).json({
      status: "erro",
      message: error.message,
    });
  }
});

// GET - Buscar histórico curricular por ID
app.get("/api/hcurriculares/:id", async (req, res) => {
  try {
    console.log(`📚 Buscando histórico curricular: ${req.params.id}`);

    const historico = await HCurricular.findById(req.params.id).populate(
      "profissional"
    );

    if (!historico) {
      return res.status(404).json({
        status: "erro",
        message: "Histórico curricular não encontrado",
      });
    }

    res.status(200).json({
      status: "sucesso",
      data: historico,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar histórico curricular:", error);
    res.status(500).json({
      status: "erro",
      message: error.message,
    });
  }
});

// ========== MIDDLEWARE DE AUTENTICAÇÃO ==========
const verificarToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  const publicRoutes = [
    "/api/auth/login",
    "/api/auth/validar-email",
    "/api/usuarios",
    "/api/profissionais",
    "/api/localizacoes",
    "/health",
    "/api/health",
    "/",
  ];

  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/api/profissionais" && req.method === "GET") return true;
    if (
      req.path.startsWith(route) &&
      (req.method === "POST" || req.method === "GET")
    ) {
      return true;
    }
    return false;
  });

  if (isPublicRoute) {
    return next();
  }

  if (!token) {
    return res.status(401).json({
      status: "erro",
      message: "Acesso negado. Token não fornecido.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "7282");
    req.usuario = decoded;
    next();
  } catch (error) {
    console.error("❌ Erro na verificação do token:", error.message);
    return res.status(401).json({
      status: "erro",
      message: "Token inválido ou expirado.",
    });
  }
};

app.use(verificarToken);

// ========== ROTAS PROTEGIDAS (APÓS MIDDLEWARE) ==========

// Rota para buscar perfil - CORRIGIDA
app.get("/api/auth/perfil/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`👤 Buscando perfil para o ID: ${id}`);

    // Tenta encontrar como Profissional primeiro
    let perfil = await Profissional.findById(id)
      .select("-senha")
      .populate("localizacao");
    let tipo = "profissional";

    // Se não for profissional, tenta encontrar como Usuário
    if (!perfil) {
      perfil = await Usuario.findById(id)
        .select("-senha")
        .populate("localizacao");
      tipo = "usuario";
    }

    if (!perfil) {
      return res.status(404).json({
        status: "erro",
        message: "Usuário ou profissional não encontrado.",
      });
    }

    console.log(`✅ Perfil encontrado: ${perfil.nome} (Tipo: ${tipo})`);

    res.status(200).json({
      status: "sucesso",
      data: perfil,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar perfil:", error);
    res.status(500).json({
      status: "erro",
      message: "Erro interno ao buscar perfil.",
    });
  }
});

app.put("/api/auth/perfil/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const dadosAtualizacao = req.body;

    console.log(`✏️ Atualizando perfil: ${id}`, dadosAtualizacao);

    // Tenta encontrar e atualizar como Profissional primeiro
    let perfilAtualizado = await Profissional.findByIdAndUpdate(
      id,
      dadosAtualizacao,
      { new: true, runValidators: true }
    )
      .select("-senha")
      .populate("localizacao");

    let tipo = "profissional";

    // Se não for profissional, tenta atualizar como Usuário
    if (!perfilAtualizado) {
      perfilAtualizado = await Usuario.findByIdAndUpdate(id, dadosAtualizacao, {
        new: true,
        runValidators: true,
      })
        .select("-senha")
        .populate("localizacao");
      tipo = "usuario";
    }

    if (!perfilAtualizado) {
      return res.status(404).json({
        status: "erro",
        message: "Usuário ou profissional não encontrado.",
      });
    }

    console.log(
      `✅ Perfil atualizado: ${perfilAtualizado.nome} (Tipo: ${tipo})`
    );

    res.status(200).json({
      status: "sucesso",
      data: perfilAtualizado,
      message: "Perfil atualizado com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar perfil:", error);
    res.status(500).json({
      status: "erro",
      message: "Erro interno ao atualizar perfil.",
    });
  }
});

// POST - Criar novo histórico curricular
app.post("/api/hcurriculares", async (req, res) => {
  try {
    console.log("📝 Criando novo histórico curricular");

    const { nome, desc, foto, profissional } = req.body;

    // Validações
    if (!nome) {
      return res.status(400).json({
        status: "erro",
        message: "Nome é obrigatório",
      });
    }

    if (!profissional) {
      return res.status(400).json({
        status: "erro",
        message: "Profissional é obrigatório",
      });
    }

    // Verificar se profissional existe
    const profissionalExiste = await Profissional.findById(profissional);
    if (!profissionalExiste) {
      return res.status(404).json({
        status: "erro",
        message: "Profissional não encontrado",
      });
    }

    const novoHistorico = await HCurricular.create({
      nome,
      desc,
      foto,
      profissional,
    });

    await novoHistorico.populate("profissional");

    console.log(`✅ Histórico curricular criado: ${novoHistorico.nome}`);

    res.status(201).json({
      status: "sucesso",
      data: novoHistorico,
      message: "Histórico curricular criado com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao criar histórico curricular:", error);
    res.status(400).json({
      status: "erro",
      message: error.message,
    });
  }
});

// PUT - Atualizar histórico curricular
app.put("/api/hcurriculares/:id", async (req, res) => {
  try {
    console.log(`✏️ Atualizando histórico curricular: ${req.params.id}`);

    const { nome, desc } = req.body;

    const historicoAtualizado = await HCurricular.findByIdAndUpdate(
      req.params.id,
      { nome, desc },
      { new: true, runValidators: true }
    ).populate("profissional");

    if (!historicoAtualizado) {
      return res.status(404).json({
        status: "erro",
        message: "Histórico curricular não encontrado",
      });
    }

    console.log(
      `✅ Histórico curricular atualizado: ${historicoAtualizado.nome}`
    );

    res.status(200).json({
      status: "sucesso",
      data: historicoAtualizado,
      message: "Histórico curricular atualizado com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar histórico curricular:", error);
    res.status(400).json({
      status: "erro",
      message: error.message,
    });
  }
});

// DELETE - Deletar histórico curricular
app.delete("/api/hcurriculares/:id", async (req, res) => {
  try {
    console.log(`🗑️ Deletando histórico curricular: ${req.params.id}`);

    const historicoDeletado = await HCurricular.findByIdAndDelete(
      req.params.id
    );

    if (!historicoDeletado) {
      return res.status(404).json({
        status: "erro",
        message: "Histórico curricular não encontrado",
      });
    }

    console.log(`✅ Histórico curricular deletado: ${historicoDeletado.nome}`);

    res.status(200).json({
      status: "sucesso",
      message: "Histórico curricular deletado com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao deletar histórico curricular:", error);
    res.status(500).json({
      status: "erro",
      message: error.message,
    });
  }
});

// ========== ROTAS PARA LOCALIZAÇÕES ==========

// GET - Listar todas as localizações
app.get("/api/localizacoes", async (req, res) => {
  try {
    console.log("📍 Buscando todas as localizações");
    const localizacoes = await Localizacao.find();
    res.status(200).json({
      status: "sucesso",
      data: localizacoes,
      total: localizacoes.length,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar localizações:", error);
    res.status(500).json({
      status: "erro",
      message: error.message,
    });
  }
});

// GET - Buscar localização por ID
app.get("/api/localizacoes/:id", async (req, res) => {
  try {
    console.log(`📍 Buscando localização: ${req.params.id}`);
    const localizacao = await Localizacao.findById(req.params.id);
    if (!localizacao) {
      return res.status(404).json({
        status: "erro",
        message: "Localização não encontrada",
      });
    }
    res.status(200).json({
      status: "sucesso",
      data: localizacao,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar localização:", error);
    res.status(500).json({
      status: "erro",
      message: error.message,
    });
  }
});

// POST - Criar nova localização
app.post("/api/localizacoes", async (req, res) => {
  try {
    console.log("📍 Criando nova localização");
    const { nome, cep, cidade, estado } = req.body;

    if (!nome || !cidade || !estado) {
      return res.status(400).json({
        status: "erro",
        message: "Nome, cidade e estado são obrigatórios",
      });
    }

    const novaLocalizacao = await Localizacao.create({
      nome,
      cep,
      cidade,
      estado,
    });

    console.log(`✅ Localização criada: ${novaLocalizacao.nome}`);
    res.status(201).json({
      status: "sucesso",
      data: novaLocalizacao,
      message: "Localização criada com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao criar localização:", error);
    res.status(400).json({
      status: "erro",
      message: error.message,
    });
  }
});

// PUT - Atualizar localização
app.put("/api/localizacoes/:id", async (req, res) => {
  try {
    console.log(`✏️ Atualizando localização: ${req.params.id}`);
    const { nome, cep, cidade, estado } = req.body;

    const localizacaoAtualizada = await Localizacao.findByIdAndUpdate(
      req.params.id,
      { nome, cep, cidade, estado },
      { new: true, runValidators: true }
    );

    if (!localizacaoAtualizada) {
      return res.status(404).json({
        status: "erro",
        message: "Localização não encontrada",
      });
    }

    console.log(`✅ Localização atualizada: ${localizacaoAtualizada.nome}`);
    res.status(200).json({
      status: "sucesso",
      data: localizacaoAtualizada,
      message: "Localização atualizada com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar localização:", error);
    res.status(400).json({
      status: "erro",
      message: error.message,
    });
  }
});

// DELETE - Deletar localização
app.delete("/api/localizacoes/:id", async (req, res) => {
  try {
    console.log(`🗑️ Deletando localização: ${req.params.id}`);
    const localizacaoDeletada = await Localizacao.findByIdAndDelete(
      req.params.id
    );

    if (!localizacaoDeletada) {
      return res.status(404).json({
        status: "erro",
        message: "Localização não encontrada",
      });
    }

    console.log(`✅ Localização deletada: ${localizacaoDeletada.nome}`);
    res.status(200).json({
      status: "sucesso",
      message: "Localização deletada com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao deletar localização:", error);
    res.status(500).json({
      status: "erro",
      message: error.message,
    });
  }
});

// ========== ROTAS PARA HISTÓRICOS PROFISSIONAIS (HProfissional) ==========

// GET - Buscar todos os históricos profissionais
app.get("/api/hprofissionais", async (req, res) => {
  try {
    console.log("💼 Buscando todos os históricos profissionais");

    const { profissional } = req.query;
    let filtro = {};

    if (profissional) {
      filtro.profissional = profissional;
    }

    const historicos = await HProfissional.find(filtro).populate(
      "profissional"
    );

    res.status(200).json({
      status: "sucesso",
      data: historicos,
      total: historicos.length,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar históricos profissionais:", error);
    res.status(500).json({
      status: "erro",
      message: error.message,
    });
  }
});

// GET - Buscar histórico profissional por ID
app.get("/api/hprofissionais/:id", async (req, res) => {
  try {
    console.log(`💼 Buscando histórico profissional: ${req.params.id}`);

    const historico = await HProfissional.findById(req.params.id).populate(
      "profissional"
    );

    if (!historico) {
      return res.status(404).json({
        status: "erro",
        message: "Histórico profissional não encontrado",
      });
    }

    res.status(200).json({
      status: "sucesso",
      data: historico,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar histórico profissional:", error);
    res.status(500).json({
      status: "erro",
      message: error.message,
    });
  }
});

// POST - Criar novo histórico profissional
app.post("/api/hprofissionais", async (req, res) => {
  try {
    console.log("📝 Criando novo histórico profissional");

    const { nome, desc, foto, profissional } = req.body;

    // Validações
    if (!nome) {
      return res.status(400).json({
        status: "erro",
        message: "Nome é obrigatório",
      });
    }

    if (!profissional) {
      return res.status(400).json({
        status: "erro",
        message: "Profissional é obrigatório",
      });
    }

    // Verificar se profissional existe
    const profissionalExiste = await Profissional.findById(profissional);
    if (!profissionalExiste) {
      return res.status(404).json({
        status: "erro",
        message: "Profissional não encontrado",
      });
    }

    const novoHistorico = await HProfissional.create({
      nome,
      desc,
      foto,
      profissional,
    });

    await novoHistorico.populate("profissional");

    console.log(`✅ Histórico profissional criado: ${novoHistorico.nome}`);

    res.status(201).json({
      status: "sucesso",
      data: novoHistorico,
      message: "Histórico profissional criado com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao criar histórico profissional:", error);
    res.status(400).json({
      status: "erro",
      message: error.message,
    });
  }
});

// PUT - Atualizar histórico profissional
app.put("/api/hprofissionais/:id", async (req, res) => {
  try {
    console.log(`✏️ Atualizando histórico profissional: ${req.params.id}`);

    const { nome, desc, foto } = req.body;

    const historicoAtualizado = await HProfissional.findByIdAndUpdate(
      req.params.id,
      { nome, desc, foto },
      { new: true, runValidators: true }
    ).populate("profissional");

    if (!historicoAtualizado) {
      return res.status(404).json({
        status: "erro",
        message: "Histórico profissional não encontrado",
      });
    }

    console.log(
      `✅ Histórico profissional atualizado: ${historicoAtualizado.nome}`
    );

    res.status(200).json({
      status: "sucesso",
      data: historicoAtualizado,
      message: "Histórico profissional atualizado com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar histórico profissional:", error);
    res.status(400).json({
      status: "erro",
      message: error.message,
    });
  }
});

// DELETE - Deletar histórico profissional
app.delete("/api/hprofissionais/:id", async (req, res) => {
  try {
    console.log(`🗑️ Deletando histórico profissional: ${req.params.id}`);

    const historicoDeletado = await HProfissional.findByIdAndDelete(
      req.params.id
    );

    if (!historicoDeletado) {
      return res.status(404).json({
        status: "erro",
        message: "Histórico profissional não encontrado",
      });
    }

    console.log(
      `✅ Histórico profissional deletado: ${historicoDeletado.nome}`
    );

    res.status(200).json({
      status: "sucesso",
      message: "Histórico profissional deletado com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao deletar histórico profissional:", error);
    res.status(500).json({
      status: "erro",
      message: error.message,
    });
  }
});

// Rota para 404 - deve ser a última
app.use("*", (req, res) => {
  console.log(`❌ Rota não encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    status: "erro",
    message: "Rota não encontrada",
  });
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error("💥 Erro não tratado:", error);
  res.status(500).json({
    status: "erro",
    message: "Erro interno do servidor",
  });
});

// ========== ROTA FALLBACK PARA SPA (DEVE SER A ÚLTIMA ROTA) ==========
// Esta rota deve ser a ÚLTIMA de todas
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  } else {
    res.status(404).json({
      status: "erro",
      message: "Rota API não encontrada",
    });
  }
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta http://localhost:${PORT}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || "desenvolvimento"}`);
});
