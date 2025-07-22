'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('cliente_digital_beneficiarios_teste', {
      id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false
      },
      operadora: Sequelize.STRING,
      convenio: Sequelize.STRING,
      grupo: Sequelize.STRING,
      subestipulante: Sequelize.STRING,
      data_proximo_reajuste: Sequelize.STRING,
      codigo_do_contrato: Sequelize.STRING,
      data_de_cancelamento: Sequelize.STRING,
      data_de_exclusao: Sequelize.STRING,
      numero_da_proposta: Sequelize.STRING,
      data_de_inclusao: Sequelize.STRING,
      data_de_assinatura: Sequelize.STRING,
      dias_de_permanencia: Sequelize.STRING,
      dia_vencimento: Sequelize.STRING,
      plano: Sequelize.STRING,
      acomodacao: Sequelize.STRING,
      produto: Sequelize.STRING,
      documento_corretor: Sequelize.STRING,
      codigo_corretor: Sequelize.STRING,
      nome_corretor: Sequelize.STRING,
      grupo_corretor: Sequelize.STRING,
      documento_supervisor: Sequelize.STRING,
      nome_supervisor: Sequelize.STRING,
      nome_correta: Sequelize.TEXT,
      grupo_correta: Sequelize.STRING,
      documento_angiariador: Sequelize.STRING,
      angiariador: Sequelize.STRING,
      nome_responsavel_financeiro: Sequelize.TEXT,
      cpf_responsavel: Sequelize.STRING,
      id_beneficiario: Sequelize.STRING,
      codigo_do_beneficiario: Sequelize.STRING,
      marca_optica: Sequelize.STRING,
      marca_optica_opcional: Sequelize.STRING,
      nome_do_beneficiario: Sequelize.TEXT,
      data_de_nascimento: Sequelize.STRING,
      idade: Sequelize.STRING,
      orgao_emissor: Sequelize.STRING,
      cpf: {
        type: Sequelize.STRING,
        allowNull: false
      },
      rg: Sequelize.STRING,
      cnh: Sequelize.STRING,
      pis: Sequelize.STRING,
      nome_da_mae: Sequelize.TEXT,
      endereco: Sequelize.TEXT,
      numero: Sequelize.STRING,
      complemento: Sequelize.TEXT,
      bairro: Sequelize.STRING,
      municipio: Sequelize.STRING,
      uf: Sequelize.STRING,
      cep: Sequelize.STRING,
      ddd_telefone: Sequelize.STRING,
      telefone: Sequelize.STRING,
      ddd_celular: Sequelize.STRING,
      celular: Sequelize.STRING,
      email_principal: Sequelize.STRING,
      email_secundario: Sequelize.TEXT,
      altura: Sequelize.STRING,
      peso: Sequelize.STRING,
      imc: Sequelize.STRING,
      vigencia: Sequelize.STRING,
      carencia: Sequelize.STRING,
      estado_civil: Sequelize.STRING,
      tipo_de_beneficiario: Sequelize.STRING,
      sexo: Sequelize.STRING,
      parentesco: Sequelize.STRING,
      status_do_beneficiario: Sequelize.STRING,
      forma_de_ajuste: Sequelize.STRING,
      ajuste: Sequelize.STRING,
      origem_de_venda: Sequelize.STRING,
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  
  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
    *
    * Example:
    * await queryInterface.dropTable('users');
    */
    await queryInterface.dropTable('cliente_digital_beneficiarios_teste');
  }
};
