require('dotenv').config();
require('pg');
const Sequelize = require('sequelize');

let sequelize = new Sequelize(
  process.env.PGDATABASE,
  process.env.PGUSER,
  process.env.PGPASSWORD,
  {
    host: process.env.PGHOST,
    dialect: 'postgres',
    port: 5432,
    dialectOptions: {
      ssl: { 
        require: true,
        rejectUnauthorized: false 
      }
    },
    query: { raw: true },
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    },
    retry: {
      max: 3
    }
  }
);

const Sector = sequelize.define('Sector', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sector_name: Sequelize.STRING
}, {
  createdAt: false,
  updatedAt: false
});

const Project = sequelize.define('Project', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: Sequelize.STRING,
  feature_img_url: Sequelize.STRING,
  summary_short: Sequelize.TEXT,
  intro_short: Sequelize.TEXT,
  impact: Sequelize.TEXT,
  original_source_url: Sequelize.STRING
}, {
  createdAt: false,
  updatedAt: false
});

Project.belongsTo(Sector, { foreignKey: 'sector_id' });

const projectData = require("../data/projectData.json");
const sectorData = require("../data/sectorData.json");

function initialize() {
  return new Promise((resolve, reject) => {
    sequelize.authenticate()
      .then(() => {
        console.log('PostgreSQL connection successful');
        return sequelize.sync();
      })
      .then(() => {
        console.log('Models synchronized successfully');
        return Sector.count();
      })
      .then(count => {
        if (count === 0 && process.env.NODE_ENV !== 'production') {
          console.log('Seeding initial data');
          return seedInitialData();
        }
        resolve();
      })
      .catch(err => {
        console.error('Database initialization error:', err);
        reject(err);
      });
  });
}

async function seedInitialData() {
  try {
    await Sector.bulkCreate(sectorData); 
    await Project.bulkCreate(projectData);

    await sequelize.query(`SELECT setval(pg_get_serial_sequence('"Sectors"', 'id'), (SELECT MAX(id) FROM "Sectors"))`);
    await sequelize.query(`SELECT setval(pg_get_serial_sequence('"Projects"', 'id'), (SELECT MAX(id) FROM "Projects"))`);

    console.log("Initial data inserted successfully");
  } catch(err) {
    console.error("Error seeding data:", err.message);
    throw err;
  }
}

function getAllProjects() {
  return new Promise((resolve, reject) => {
    Project.findAll({ include: [Sector] })
      .then(projects => {
        if (projects.length > 0) {
          resolve(projects);
        } else {
          reject("No projects found");
        }
      })
      .catch(err => {
        console.error("Error fetching all projects:", err);
        reject(err);
      });
  });
}

function getProjectById(projectId) {
  return new Promise((resolve, reject) => {
    Project.findAll({ 
      include: [Sector],
      where: {
        id: projectId
      }
    })
      .then(projects => {
        if (projects.length > 0) {
          resolve(projects[0]);
        } else {
          reject("Unable to find requested project");
        }
      })
      .catch(err => {
        console.error(`Error fetching project ID ${projectId}:`, err);
        reject(err);
      });
  });
}

function getProjectsBySector(sector) {
  return new Promise((resolve, reject) => {
    Project.findAll({
      include: [Sector], 
      where: { 
        '$Sector.sector_name$': {
          [Sequelize.Op.iLike]: `%${sector}%`
        }
      }
    })
      .then(projects => {
        if (projects.length > 0) {
          resolve(projects);
        } else {
          reject("Unable to find requested projects");
        }
      })
      .catch(err => {
        console.error(`Error fetching projects for sector ${sector}:`, err);
        reject(err);
      });
  });
}

function addProject(projectData) {
  return new Promise((resolve, reject) => {
    Project.create(projectData)
      .then(() => {
        resolve();
      })
      .catch(err => {
        console.error("Error adding project:", err);
        if (err.errors && err.errors.length > 0) {
          reject(err.errors[0].message);
        } else {
          reject("Failed to add project");
        }
      });
  });
}

function editProject(id, projectData) {
  return new Promise((resolve, reject) => {
    Project.update(projectData, {
      where: { id: id }
    })
      .then(() => {
        resolve();
      })
      .catch(err => {
        console.error(`Error updating project ID ${id}:`, err);
        if (err.errors && err.errors.length > 0) {
          reject(err.errors[0].message);
        } else {
          reject("Failed to update project");
        }
      });
  });
}

function deleteProject(id) {
  return new Promise((resolve, reject) => {
    Project.destroy({
      where: { id: id }
    })
      .then(() => {
        resolve();
      })
      .catch(err => {
        console.error(`Error deleting project ID ${id}:`, err);
        if (err.errors && err.errors.length > 0) {
          reject(err.errors[0].message);
        } else {
          reject("Failed to delete project");
        }
      });
  });
}

function getAllSectors() {
  return new Promise((resolve, reject) => {
    Sector.findAll()
      .then(sectors => {
        if (sectors.length > 0) {
          resolve(sectors);
        } else {
          reject("No sectors found");
        }
      })
      .catch(err => {
        console.error("Error fetching sectors:", err);
        reject(err);
      });
  });
}

module.exports = {
  initialize,
  getAllProjects,
  getProjectById,
  getProjectsBySector,
  addProject,
  editProject,
  deleteProject,
  getAllSectors,
  Sector,
  Project,
  sequelize
};

if (require.main === module) {
  console.log("Running data seeder...");
  sequelize
  .sync()
  .then(async () => {
    try{
      await Sector.bulkCreate(sectorData); 
      await Project.bulkCreate(projectData);

      await sequelize.query(`SELECT setval(pg_get_serial_sequence('"Sectors"', 'id'), (SELECT MAX(id) FROM "Sectors"))`);
      await sequelize.query(`SELECT setval(pg_get_serial_sequence('"Projects"', 'id'), (SELECT MAX(id) FROM "Projects"))`);

      console.log("-----");
      console.log("data inserted successfully");
    } catch(err) {
      console.log("-----");
      console.log(err.message);
    }

    process.exit();
  })
  .catch((err) => {
    console.log('Unable to connect to the database:', err);
    process.exit(1);
  });
}