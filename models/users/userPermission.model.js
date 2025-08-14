module.exports = (sequelize, Sequelize) => {
    const UserPermissions = sequelize.define("users_permissions", {
        dashboard: {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
        },
        sales: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        commissions: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        your_data: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        sales_support: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        sell: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        bonuses: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        commission_report: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        bonus_rule: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        validity_and_closing: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        contact: {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
        },
        brokers: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        beneficiaries: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        doubts: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        users_data: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        accredited_networks: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        payment: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        report: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        supervisors_portal: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        wallets: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        wallets_transactions: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        wallets_payments: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        producers: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        campaign: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        panelBI: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        nfs: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
    });

    return UserPermissions;
};