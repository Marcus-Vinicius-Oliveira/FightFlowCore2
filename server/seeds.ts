import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import bcrypt from 'bcryptjs';
import { planos, users } from "@shared/schema";
import type { InsertPlano, InsertUser } from "@shared/schema";
import { eq } from 'drizzle-orm';

// Configure WebSocket (same as main app)
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not found");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

const initialPlanos: InsertPlano[] = [
  {
    nome: "Beta Gratuito",
    limiteAlunos: 10,
    precoMensal: 0, // Free plan
    ativo: true
  },
  {
    nome: "Básico",
    limiteAlunos: 50,
    precoMensal: 4900, // R$ 49,00 in cents
    ativo: true
  },
  {
    nome: "Profissional",
    limiteAlunos: 200,
    precoMensal: 9900, // R$ 99,00 in cents
    ativo: true
  },
  {
    nome: "Enterprise",
    limiteAlunos: 500,
    precoMensal: 19900, // R$ 199,00 in cents
    ativo: true
  }
];

// Bootstrap SUPER_ADMIN user credentials (can be overridden via env vars)
const BOOTSTRAP_ADMIN = {
  email: process.env.SA_EMAIL || "superadmin@centrodelutas.com",
  password: process.env.SA_PASSWORD || "SuperAdmin123!",
  name: "Super Administrador"
};

async function seedSuperAdmin() {
  try {
    console.log("👤 Verificando usuário SUPER_ADMIN...");
    
    // Check if SUPER_ADMIN already exists
    const existingSuperAdmin = await db.select()
      .from(users)
      .where(eq(users.role, 'SUPER_ADMIN'));
    
    if (existingSuperAdmin.length > 0) {
      console.log(`⚠️  Usuário SUPER_ADMIN já existe (${existingSuperAdmin[0].email}). Pulando criação.`);
      return;
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(BOOTSTRAP_ADMIN.password, 10);
    
    // Create SUPER_ADMIN user
    const superAdminUser: InsertUser = {
      email: BOOTSTRAP_ADMIN.email,
      password: hashedPassword,
      name: BOOTSTRAP_ADMIN.name,
      role: 'SUPER_ADMIN',
      academyId: null, // SUPER_ADMIN has no academy restriction
      active: true,
      firstAccess: false // No password change required for bootstrap user
    };
    
    const [insertedUser] = await db.insert(users).values(superAdminUser).returning();
    
    console.log("✅ Usuário SUPER_ADMIN criado com sucesso:");
    console.log(`   • Email: ${insertedUser.email}`);
    console.log(`   • Nome: ${insertedUser.name}`);
    console.log(`   • Senha: ${BOOTSTRAP_ADMIN.password}`);
    
  } catch (error) {
    console.error("❌ Erro ao criar usuário SUPER_ADMIN:", error);
    throw error;
  }
}

async function seedPlanos() {
  try {
    console.log("🌱 Verificando planos...");
    
    // Check if plans already exist
    const existingPlanos = await db.select().from(planos);
    
    if (existingPlanos.length > 0) {
      console.log(`⚠️  ${existingPlanos.length} planos já existem no banco. Pulando seeding.`);
      return;
    }
    
    // Insert initial plans
    const insertedPlanos = await db.insert(planos).values(initialPlanos).returning();
    
    console.log("✅ Planos criados com sucesso:");
    insertedPlanos.forEach(plano => {
      const preco = plano.precoMensal === 0 ? "Gratuito" : `R$ ${(plano.precoMensal / 100).toFixed(2)}`;
      console.log(`   • ${plano.nome}: ${plano.limiteAlunos} alunos - ${preco}/mês`);
    });
    
  } catch (error) {
    console.error("❌ Erro ao fazer seeding dos planos:", error);
    throw error;
  }
}

async function seedDatabase() {
  try {
    console.log("🚀 Iniciando seeding completo do banco de dados...");
    
    await seedSuperAdmin();
    await seedPlanos();
    
    console.log("🎉 Seeding completo concluído com sucesso!");
    
  } catch (error) {
    console.error("💥 Seeding falhou:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding falhou:", error);
      process.exit(1);
    });
}

export { seedDatabase, seedPlanos, seedSuperAdmin };