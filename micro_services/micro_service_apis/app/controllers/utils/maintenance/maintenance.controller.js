exports.getMaintenance = async (req, res) => {
    const isMaintenance = process.env.MAINTENANCE === 'true'; // converte corretamente para boolean

    res.send({
        isMaintenance,
        sucesso: true
    });
}