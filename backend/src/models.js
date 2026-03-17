const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './vinted.sqlite',
  logging: false,
});

const Task = sequelize.define('MonitorTask', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  keywords: {
    type: DataTypes.STRING,
    allowNull: false
  },
  minPrice: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  maxPrice: {
    type: DataTypes.FLOAT
  },
  size: {
    type: DataTypes.STRING
  },
  condition: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  webhookUrl: {
    type: DataTypes.STRING
  },
  autoBuy: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastRun: {
    type: DataTypes.DATE
  }
});

module.exports = { sequelize, Task };
