require('dotenv').config();
require('pg');
const Sequelize = require('sequelize');

// Configure Sequelize
let sequelize = new Sequelize(
  process.env.PGDATABASE,
  process.env.PGUSER,
  process.env.PGPASSWORD,
  {
    host: process.env.PGHOST,
    dialect: 'postgres',
    port: 5432,
    dialectOptions: {
      ssl: { rejectUnauthorized: false }
    },
    query: { raw: true }
  }
);

// Define models
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

// Define relationships
Project.belongsTo(Sector, { foreignKey: 'sector_id' });

// Load data files
const projectData = require("../data/projectData.json");
const sectorData = require("../data/sectorData.json");

// Initialize function
function initialize() {
  return new Promise((resolve, reject) => {
    sequelize.sync()
      .then(() => {
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
}

// Get all projects
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
        reject(err);
      });
  });
}

// Get project by ID
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
        reject(err);
      });
  });
}

// Get projects by sector
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
        reject(err);
      });
  });
}

// Add project
function addProject(projectData) {
  return new Promise((resolve, reject) => {
    Project.create(projectData)
      .then(() => {
        resolve();
      })
      .catch(err => {
        if (err.errors && err.errors.length > 0) {
          reject(err.errors[0].message);
        } else {
          reject("Failed to add project");
        }
      });
  });
}

// Edit project
function editProject(id, projectData) {
  return new Promise((resolve, reject) => {
    Project.update(projectData, {
      where: { id: id }
    })
      .then(() => {
        resolve();
      })
      .catch(err => {
        if (err.errors && err.errors.length > 0) {
          reject(err.errors[0].message);
        } else {
          reject("Failed to update project");
        }
      });
  });
}

// Delete project
function deleteProject(id) {
  return new Promise((resolve, reject) => {
    Project.destroy({
      where: { id: id }
    })
      .then(() => {
        resolve();
      })
      .catch(err => {
        if (err.errors && err.errors.length > 0) {
          reject(err.errors[0].message);
        } else {
          reject("Failed to delete project");
        }
      });
  });
}

// Get all sectors
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

// Bulk insert code - run with node modules/projects.js
if (require.main === module) {
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
  });
}