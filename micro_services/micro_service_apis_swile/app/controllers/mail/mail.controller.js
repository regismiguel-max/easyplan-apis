const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.MAILERHOST,
    port: process.env.MAILERPORT,
    secure: process.env.MAILERSECURE,
    auth: {
        user: process.env.MAILERAUTHUSER,
        pass: process.env.MAILERAUTHPASS
    },
});

sendMessageCodeImage = async (req, res, code) => {
    let name = req.body.name.toLowerCase();
    await transporter.sendMail({
        from: `"EasyPlan" <${process.env.MAILERAUTHUSER}>`,
        to: `${req.body.email}`,
        // to: `ds.gustavo10@gmail.com`,
        subject: "Autenticação Aplicativo EasyPlan Clientes",
        html: `
<div style="font-size:14px;line-height:1.5;background-color:#eee" bgcolor="#eeeeee">
    <table class="m_8878348065808527974wrapper-table" cellpadding="5" cellspacing="0" width="100%" border="0"
        style="border-collapse:collapse;font-size:14px;line-height:1.5;background-repeat:no-repeat;background-position:center top; background: eeeeee;">
        <tr style="border-color:transparent">
            <td align="center" style="border-collapse:collapse;border-color:transparent">
                <table cellpadding="0" cellspacing="0" width="600px" id="m_8878348065808527974bodyTable" border="0"
                    bgcolor="#ffffff" style="border-collapse:collapse;font-size:14px;line-height:1.5">
                    <tr style="border-color:transparent">
                        <td border="0" cellpadding="0" cellspacing="0"
                            style="border-collapse:collapse;border-color:transparent">
                            <table cellpadding="0" cellspacing="0"
                                style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%" border="0"
                                width="100%">
                                <tr style="border-color:transparent">
                                    <td style="border-collapse:collapse;border-color:transparent;padding-left:0;padding-right:0;padding-top:0;padding-bottom:0;vertical-align:top"
                                        border="0" cellpadding="0" cellspacing="0" valign="top">
                                        <table cellpadding="0" cellspacing="0"
                                            style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%"
                                            border="0" width="100%">
                                            <tr style="border-color:transparent">
                                                <th width="600"
                                                    style="border-color:transparent;font-weight:400;text-align:start;vertical-align:top"
                                                    cellpadding="0" cellspacing="0"
                                                    class="m_8878348065808527974tc m_8878348065808527974responsive"
                                                    align="start" valign="top">
                                                    <table border="0" width="100%" cellpadding="0" cellspacing="0"
                                                        style="border-collapse:collapse;font-size:14px;line-height:1.5;border-top-right-radius:0;border-top-left-radius:0;border-bottom-left-radius:0;border-bottom-right-radius:0">
                                                        <tr style="border-color:transparent">
                                                            <td cellpadding="0" cellspacing="0"
                                                                style="border-collapse:collapse;border-color:transparent;vertical-align:top"
                                                                valign="top">
                                                                <table width="100%" cellpadding="0" cellspacing="0"
                                                                    style="border-collapse:separate;font-size:14px;line-height:1.5;background-color:#eee;padding-left:0;padding-right:0;padding-top:0;padding-bottom:0;height:20px"
                                                                    bgcolor="#eeeeee" height="20">
                                                                    <tr style="border-color:transparent">
                                                                        <td height="20"
                                                                            style="border-collapse:collapse;border-color:transparent">
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </th>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table cellpadding="0" cellspacing="0"
                                style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%" border="0"
                                width="100%">
                                <tr style="border-color:transparent">
                                    <td style="border-collapse:collapse;border-color:transparent;padding-left:0;padding-right:0;padding-top:0;padding-bottom:0;vertical-align:top"
                                        border="0" cellpadding="0" cellspacing="0" valign="top">
                                        <table cellpadding="0" cellspacing="0"
                                            style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%"
                                            border="0" width="100%">
                                            <tr style="border-color:transparent">
                                                <th width="600"
                                                    style="border-color:transparent;font-weight:400;text-align:start;vertical-align:top"
                                                    cellpadding="0" cellspacing="0"
                                                    class="m_8878348065808527974tc m_8878348065808527974responsive"
                                                    align="start" valign="top">
                                                    <table border="0" width="100%" cellpadding="0" cellspacing="0"
                                                        style="border-collapse:collapse;font-size:14px;line-height:1.5;border-top-right-radius:0;border-top-left-radius:0;border-bottom-left-radius:0;border-bottom-right-radius:0">
                                                        <tr style="border-color:transparent">
                                                            <td cellpadding="0" cellspacing="0"
                                                                style="border-collapse:collapse;border-color:transparent;vertical-align:top"
                                                                valign="top">
                                                                <table width="100%" cellpadding="0" cellspacing="0"
                                                                    id="m_8878348065808527974wout_block_4_element_0"
                                                                    style="border-collapse:separate;font-size:14px;line-height:1.5;overflow:hidden">
                                                                    <tr
                                                                        style="border-color:transparent;color:#444;font-family:Arial,&quot;Helvetica Neue&quot;,Helvetica,sans-serif">
                                                                        <td class="m_8878348065808527974content-cell m_8878348065808527974padding-lr-0 m_8878348065808527974padding-top-0 m_8878348065808527974padding-bottom-0"
                                                                            width="600"
                                                                            style="border-collapse:collapse;border-color:transparent;vertical-align:top;padding-left:0;padding-right:0;padding-top:0;padding-bottom:0"
                                                                            valign="top">
                                                                            <div id="m_8878348065808527974wout_block_4_element_0"
                                                                                style="font-size:14px;line-height:1.5;width:100%;height:259;display:flex;justify-content:space-evenly;padding-top:30px"
                                                                                width="100%" height="259">
                                                                                <img border="0" width="512"
                                                                                    height="auto"
                                                                                    class="m_8878348065808527974desktop m_8878348065808527974sp-img"
                                                                                    align="left"
                                                                                    alt="Logo_EasyPlan_Slogan"
                                                                                    src="https://apis.easyplan.com.br/uploads/EasyPlan/Logo_easyPlan_Slogan.png"
                                                                                    style="height:auto;line-height:100%;outline:0;text-decoration:none;border:0;margin:0 0 0 44px;display:block">
                                                                                <div
                                                                                    style="font-size:14px;line-height:1.5">
                                                                                    <img border="0" width="100%"
                                                                                        height="auto"
                                                                                        class="m_8878348065808527974mobile m_8878348065808527974sp-img"
                                                                                        align="left"
                                                                                        alt="Logo_EasyPlan_Slogan"
                                                                                        src="https://apis.easyplan.com.br/uploads/EasyPlan/Logo_easyPlan_Slogan.png"
                                                                                        style="height:auto;line-height:100%;outline:0;text-decoration:none;border:0;display:none;width:100%;max-width:512px!important">
                                                                                </div>
                                                                            </div>
                                                                            <div
                                                                                style="font-size:14px;line-height:1.5;clear:both">
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                    <table border="0" width="100%" cellpadding="0" cellspacing="0"
                                                        style="border-collapse:collapse;font-size:14px;line-height:1.5;border-top-right-radius:0;border-top-left-radius:0;border-bottom-left-radius:0;border-bottom-right-radius:0">
                                                        <tr style="border-color:transparent">
                                                            <td cellpadding="0" cellspacing="0"
                                                                style="border-collapse:collapse;border-color:transparent;vertical-align:top"
                                                                valign="top">
                                                                <table width="100%" cellpadding="0" cellspacing="0"
                                                                    id="m_8878348065808527974wout_block_out_block_5"
                                                                    style="border-collapse:separate;font-size:14px;line-height:1.5;font-weight:normal;margin:0;overflow:hidden">
                                                                    <tr
                                                                        style="border-color:transparent;color:#444;font-family:Arial,&quot;Helvetica Neue&quot;,Helvetica,sans-serif">
                                                                        <td class="m_8878348065808527974content-cell m_8878348065808527974padding-bottom-0"
                                                                            width="540"
                                                                            style="border-collapse:collapse;border-color:transparent;vertical-align:top;padding-left:30px;padding-right:30px;padding-top:20px;padding-bottom:0"
                                                                            valign="top">
                                                                            <div style="font-size:14px;line-height:1.5">
                                                                            </div>
                                                                            <div style="font-size:14px;line-height:1.5">
                                                                                <div
                                                                                    style="font-size:14px;line-height:1.5">
                                                                                    <span>Olá</span> <span style="text-transform:capitalize;">${name}</span><span>!</span>
                                                                                </div>
                                                                                <div
                                                                                    style="font-size:14px;line-height:1.5">
                                                                                    <span></span>
                                                                                </div>
                                                                                <div
                                                                                    style="font-size:14px;line-height:1.5">
                                                                                    <span>Seja muito bem-vindo ao canal
                                                                                        de <strong>Suporte
                                                                                            EasyPlan</strong>.</span>
                                                                                </div>
                                                                                <div
                                                                                    style="font-size:14px;line-height:1.5">
                                                                                    <span></span>
                                                                                </div>
                                                                                <div
                                                                                    style="font-size:14px;line-height:1.5">
                                                                                    <span>Para validar o seu acesso no
                                                                                        aplicativo <strong>EasyPlan
                                                                                            Clientes</strong>, por
                                                                                        favor, utilize o código
                                                                                        abaixo:</span>
                                                                                </div>
                                                                                <div
                                                                                    style="font-size:14px;line-height:1.5">
                                                                                    <span></span>
                                                                                </div>
                                                                                <div
                                                                                    style="font-size:14px;line-height:1.5">
                                                                                    <span></span>
                                                                                </div>
                                                                            </div>
                                                                            <div
                                                                                style="font-size:14px;line-height:1.5;clear:both">
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </th>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table cellpadding="0" cellspacing="0"
                                style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%" border="0"
                                width="100%">
                                <tr style="border-color:transparent">
                                    <td style="border-collapse:collapse;border-color:transparent;padding-left:0;padding-right:0;padding-top:0;padding-bottom:0;vertical-align:top"
                                        border="0" cellpadding="0" cellspacing="0" valign="top">
                                        <table cellpadding="0" cellspacing="0"
                                            style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%"
                                            border="0" width="100%">
                                            <tr style="border-color:transparent">
                                                <th width="600"
                                                    style="border-color:transparent;font-weight:400;text-align:start;vertical-align:top"
                                                    cellpadding="0" cellspacing="0"
                                                    class="m_8878348065808527974tc m_8878348065808527974responsive"
                                                    align="start" valign="top">
                                                    <table border="0" width="100%" cellpadding="0" cellspacing="0"
                                                        style="border-collapse:collapse;font-size:14px;line-height:1.5;border-top-right-radius:0;border-top-left-radius:0;border-bottom-left-radius:0;border-bottom-right-radius:0">
                                                        <tr style="border-color:transparent">
                                                            <td cellpadding="0" cellspacing="0"
                                                                style="border-collapse:collapse;border-color:transparent;vertical-align:top"
                                                                valign="top">
                                                                <table width="100%" cellpadding="0" cellspacing="0"
                                                                    style="border-collapse:separate;font-size:14px;line-height:1.5;overflow:hidden">
                                                                    <tr
                                                                        style="border-color:transparent;color:#444;font-family:Arial,&quot;Helvetica Neue&quot;,Helvetica,sans-serif">
                                                                        <td class="m_8878348065808527974content-cell"
                                                                            width="540"
                                                                            style="border-collapse:collapse;border-color:transparent;vertical-align:top;padding-left:30px;padding-right:30px;padding-top:10px;padding-bottom:10px"
                                                                            valign="top">
                                                                            <table cellpadding="0" border="0"
                                                                                cellspacing="0" align="left"
                                                                                class="m_8878348065808527974sp-button"
                                                                                style="border-collapse:collapse;font-size:14px;line-height:1.5;border-color:#ddd;border-width:1px;border-style:solid;border:0;width:auto!important;border-radius:5px;background:#00a7ba"
                                                                                width="auto !important">
                                                                                <tbody>
                                                                                    <tr
                                                                                        style="border-color:transparent">
                                                                                        <td class="m_8878348065808527974sp-button-text"
                                                                                            style="border-collapse:collapse;border-color:transparent;padding:0;border-width:0;border-style:none;border:0;border-radius:5px;width:auto;height:40px;vertical-align:middle;text-align:center"
                                                                                            width="auto" height="40"
                                                                                            valign="middle"
                                                                                            align="center">
                                                                                            <table cellpadding="0"
                                                                                                border="0"
                                                                                                cellspacing="0"
                                                                                                width="100%"
                                                                                                style="border-collapse:collapse;font-size:14px;line-height:1.5;border:0">
                                                                                                <tr
                                                                                                    style="border-color:transparent">
                                                                                                    <td align="center"
                                                                                                        style="border-collapse:collapse;border-color:transparent;padding:0 10px;border:0;line-height:1">
                                                                                                        <div
                                                                                                            style="font-size:16px;line-height:1.5;color: #fff;">
                                                                                                            <span><strong>${code}</strong></span>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            </table>
                                                                                        </td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
                                                                            <div
                                                                                style="font-size:14px;line-height:1.5;clear:both">
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                    <table border="0" width="100%" cellpadding="0" cellspacing="0"
                                                        style="border-collapse:collapse;font-size:14px;line-height:1.5;border-top-right-radius:0;border-top-left-radius:0;border-bottom-left-radius:0;border-bottom-right-radius:0">
                                                        <tr style="border-color:transparent">
                                                            <td cellpadding="0" cellspacing="0"
                                                                style="border-collapse:collapse;border-color:transparent;vertical-align:top"
                                                                valign="top">
                                                                <table width="100%" cellpadding="0" cellspacing="0"
                                                                    id="m_8878348065808527974wout_block_out_block_5"
                                                                    style="border-collapse:separate;font-size:14px;line-height:1.5;font-weight:normal;margin:0;overflow:hidden">
                                                                    <tr
                                                                        style="border-color:transparent;color:#444;font-family:Arial,&quot;Helvetica Neue&quot;,Helvetica,sans-serif">
                                                                        <td class="m_8878348065808527974content-cell m_8878348065808527974padding-bottom-0"
                                                                            width="540"
                                                                            style="border-collapse:collapse;border-color:transparent;vertical-align:top;padding-left:30px;padding-right:30px;padding-top:0;padding-bottom:0"
                                                                            valign="top">
                                                                            <div style="font-size:14px;line-height:1.5">
                                                                                <div
                                                                                    style="font-size:14px;line-height:1.5">
                                                                                    <span>Agradecemos por escolher a
                                                                                        <strong>EasyPlan</strong>!,</span>
                                                                                </div>
                                                                                <br><br>
                                                                                <div
                                                                                    style="font-size:14px;line-height:1.5">
                                                                                    <em style="color:inherit">Favor não
                                                                                        responder, esta é uma mensagem
                                                                                        automática.</em>
                                                                                </div>
                                                                                <div
                                                                                    style="font-size:14px;line-height:1.5">
                                                                                    <em style="color:inherit"></em>
                                                                                </div>
                                                                            </div>
                                                                            <div
                                                                                style="font-size:14px;line-height:1.5;clear:both">
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </th>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table cellpadding="0" cellspacing="0"
                                style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%" border="0"
                                width="100%">
                                <tr style="border-color:transparent">
                                    <td style="border-collapse:collapse;border-color:transparent;padding-left:0;padding-right:0;padding-top:0;padding-bottom:0;vertical-align:top"
                                        border="0" cellpadding="0" cellspacing="0" valign="top">
                                        <table cellpadding="0" cellspacing="0"
                                            style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%"
                                            border="0" width="100%">
                                            <tr style="border-color:transparent">
                                                <th width="600"
                                                    style="border-color:transparent;font-weight:400;text-align:start;vertical-align:top"
                                                    cellpadding="0" cellspacing="0"
                                                    class="m_8878348065808527974tc m_8878348065808527974responsive"
                                                    align="start" valign="top">
                                                    <table border="0" width="100%" cellpadding="0" cellspacing="0"
                                                        style="border-collapse:collapse;font-size:14px;line-height:1.5;border-top-right-radius:0;border-top-left-radius:0;border-bottom-left-radius:0;border-bottom-right-radius:0">
                                                        <tr style="border-color:transparent">
                                                            <td cellpadding="0" cellspacing="0"
                                                                style="border-collapse:collapse;border-color:transparent;vertical-align:top"
                                                                valign="top">
                                                                <table width="100%" cellpadding="0" cellspacing="0"
                                                                    style="border-collapse:separate;font-size:14px;line-height:1.5;background-color:#eee;padding-left:0;padding-right:0;padding-top:0;padding-bottom:0;height:35px"
                                                                    bgcolor="#eeeeee" height="35">
                                                                    <tr style="border-color:transparent">
                                                                        <td height="35"
                                                                            style="border-collapse:collapse;border-color:transparent">
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </th>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table cellpadding="0" cellspacing="0"
                                style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%" border="0"
                                width="100%">
                                <tr style="border-color:transparent">
                                    <td style="border-collapse:collapse;border-color:transparent;padding-left:0;padding-right:0;padding-top:0;padding-bottom:0;vertical-align:top"
                                        border="0" cellpadding="0" cellspacing="0" valign="top">
                                        <table cellpadding="0" cellspacing="0"
                                            style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%"
                                            border="0" width="100%">
                                            <tr style="border-color:transparent">
                                                <th width="600"
                                                    style="border-color:transparent;font-weight:400;text-align:start;vertical-align:top"
                                                    cellpadding="0" cellspacing="0"
                                                    class="m_8878348065808527974tc m_8878348065808527974responsive"
                                                    align="start" valign="top">
                                                    <table border="0" width="100%" cellpadding="0" cellspacing="0"
                                                        style="border-collapse:collapse;font-size:14px;line-height:1.5;border-top-right-radius:0;border-top-left-radius:0;border-bottom-left-radius:0;border-bottom-right-radius:0">
                                                        <tr style="border-color:transparent">
                                                            <td cellpadding="0" cellspacing="0"
                                                                style="border-collapse:collapse;border-color:transparent;vertical-align:top"
                                                                valign="top">
                                                                <table width="100%" cellpadding="0" cellspacing="0"
                                                                    id="m_8878348065808527974wout_block_out_block_8"
                                                                    style="border-collapse:separate;font-size:14px;line-height:1.5;background-color:#eee;font-weight:normal;margin:0;overflow:hidden"
                                                                    bgcolor="#eeeeee">
                                                                    <tr
                                                                        style="border-color:transparent;color:#444;font-family:Arial,&quot;Helvetica Neue&quot;,Helvetica,sans-serif">
                                                                        <td class="m_8878348065808527974content-cell m_8878348065808527974padding-top-0 m_8878348065808527974padding-bottom-0"
                                                                            width="540"
                                                                            style="border-collapse:collapse;border-color:transparent;vertical-align:top;padding-left:30px;padding-right:30px;padding-top:0;padding-bottom:0"
                                                                            valign="top">
                                                                            <p style="font-size:inherit;line-height:inherit;margin:0 0 10px;color:inherit;font-family:Arial,&quot;Helvetica Neue&quot;,Helvetica,sans-serif;text-align:center;font-weight:normal;padding:0"
                                                                                align="center">
                                                                                <span
                                                                                    style="font-size:13px;line-height:19.5px">©
                                                                                    Copyright, 2024, EasyPlan • SCN
                                                                                    QUADRA 5, BLOCO A, SALAS 217 E 218,
                                                                                    PARTE 6 CEP: 70.715-900</span>
                                                                            </p>
                                                                            <div
                                                                                style="font-size:14px;line-height:1.5;clear:both">
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                    <table border="0" width="100%" cellpadding="0" cellspacing="0"
                                                        style="border-collapse:collapse;font-size:14px;line-height:1.5;border-top-right-radius:0;border-top-left-radius:0;border-bottom-left-radius:0;border-bottom-right-radius:0">
                                                        <tr style="border-color:transparent">
                                                            <td cellpadding="0" cellspacing="0"
                                                                style="border-collapse:collapse;border-color:transparent;vertical-align:top"
                                                                valign="top">
                                                                <table width="100%" cellpadding="0" cellspacing="0"
                                                                    style="border-collapse:separate;font-size:14px;line-height:1.5;background-color:#eee;text-align:center;overflow:hidden"
                                                                    bgcolor="#eeeeee" align="center">
                                                                    <tr
                                                                        style="border-color:transparent;color:#444;font-family:Arial,&quot;Helvetica Neue&quot;,Helvetica,sans-serif">
                                                                        <td class="m_8878348065808527974content-cell m_8878348065808527974padding-top-0"
                                                                            width="540"
                                                                            style="border-collapse:collapse;border-color:transparent;vertical-align:top;padding-left:30px;padding-right:30px;padding-top:0;padding-bottom:5px"
                                                                            valign="top">
                                                                            <table class="m_8878348065808527974social"
                                                                                cellpadding="5" border="0"
                                                                                cellspacing="0"
                                                                                style="border-collapse:collapse;font-size:14px;line-height:1;border-color:transparent;border-width:0;border-style:none;border:0;display:inline-block;border-spacing:0">
                                                                                <tr style="border-color:transparent">
                                                                                    <th class="m_8878348065808527974social_element"
                                                                                        style="border-color:transparent;padding:2px 5px;font-size:13px;font-family:Arial,sans-serif;line-height:32px;font-weight:400;text-align:left;border-width:0;border-style:none;border:0"
                                                                                        align="left">
                                                                                        <a href="https://s8659497.sendpul.se/a360/public/statistic/v2/click/a237ea5d5601309745fc96802b13c4d12971"
                                                                                            style="text-decoration:none;color:#0089bf"
                                                                                            target="_blank"
                                                                                            data-saferedirecturl="https://www.google.com/url?hl=pt-BR&amp;q=https://s8659497.sendpul.se/a360/public/statistic/v2/click/a237ea5d5601309745fc96802b13c4d12971&amp;source=gmail&amp;ust=1724333532019000&amp;usg=AOvVaw18v9Pmf8LNLiIgdlwsZHuY"><img
                                                                                                border="0"
                                                                                                alt="Facebook"
                                                                                                class="m_8878348065808527974social m_8878348065808527974smallImg"
                                                                                                style="height:auto;line-height:100%;outline:0;text-decoration:none;border:0;border-color:transparent;border-width:0;border-style:none;display:block;margin:5px"
                                                                                                vspace="5" hspace="5"
                                                                                                title="Facebook"
                                                                                                width="32" height="auto"
                                                                                                src="https://ci3.googleusercontent.com/meips/ADKq_NaX-O47yx_IcS3yGoowAPUQ6eg0HCCzQS347A426jmpiZs0lzREDJDcXDCO0mQ0peG5NdyEsyNIkyq-TRO48u8E4rgiuiKvuVk_EhEnDdC8NBV06TOtiBhsn9Q=s0-d-e1-ft#https://s8659497.sendpul.se/img/constructor/social/round/facebook.png"></a>
                                                                                    </th>
                                                                                    <th class="m_8878348065808527974social_element"
                                                                                        style="border-color:transparent;padding:2px 5px;font-size:13px;font-family:Arial,sans-serif;line-height:32px;font-weight:400;text-align:left;border-width:0;border-style:none;border:0"
                                                                                        align="left">
                                                                                        <a href="https://s8659497.sendpul.se/a360/public/statistic/v2/click/d7543bc7a48cdd08473e9e4a2a1aac651847"
                                                                                            style="text-decoration:none;color:#0089bf"
                                                                                            target="_blank"
                                                                                            data-saferedirecturl="https://www.google.com/url?hl=pt-BR&amp;q=https://s8659497.sendpul.se/a360/public/statistic/v2/click/d7543bc7a48cdd08473e9e4a2a1aac651847&amp;source=gmail&amp;ust=1724333532019000&amp;usg=AOvVaw0-fLZ41pY1YOUPpsc4k7pe"><img
                                                                                                border="0"
                                                                                                alt="Instagram"
                                                                                                class="m_8878348065808527974social m_8878348065808527974smallImg"
                                                                                                style="height:auto;line-height:100%;outline:0;text-decoration:none;border:0;border-color:transparent;border-width:0;border-style:none;display:block;margin:5px"
                                                                                                vspace="5" hspace="5"
                                                                                                title="Instagram"
                                                                                                width="32" height="auto"
                                                                                                src="https://ci3.googleusercontent.com/meips/ADKq_NaTN_Ol-FFksucAUcHy1ld4XpXOwxMgnsHP0F-loXh8QxYZ2YFOIORgeHt3FHqrdZvGTKpS-pPMA3ud8FXb_eI6O2E3ZREXIzfbdejkyS_6v9XoPOuPjflgXwWL=s0-d-e1-ft#https://s8659497.sendpul.se/img/constructor/social/round/instagram.png"></a>
                                                                                    </th>
                                                                                    <th class="m_8878348065808527974social_element"
                                                                                        style="border-color:transparent;padding:2px 5px;font-size:13px;font-family:Arial,sans-serif;line-height:32px;font-weight:400;text-align:left;border-width:0;border-style:none;border:0"
                                                                                        align="left">
                                                                                        <a href="https://s8659497.sendpul.se/a360/public/statistic/v2/click/d56151b12c1af22b4611a694904c40be5e77"
                                                                                            style="text-decoration:none;color:#0089bf"
                                                                                            target="_blank"
                                                                                            data-saferedirecturl="https://www.google.com/url?hl=pt-BR&amp;q=https://s8659497.sendpul.se/a360/public/statistic/v2/click/d56151b12c1af22b4611a694904c40be5e77&amp;source=gmail&amp;ust=1724333532019000&amp;usg=AOvVaw2vQXb2R10Vam3eMOivzi7A"><img
                                                                                                border="0"
                                                                                                alt="LinkedIn"
                                                                                                class="m_8878348065808527974social m_8878348065808527974smallImg"
                                                                                                style="height:auto;line-height:100%;outline:0;text-decoration:none;border:0;border-color:transparent;border-width:0;border-style:none;display:block;margin:5px"
                                                                                                vspace="5" hspace="5"
                                                                                                title="LinkedIn"
                                                                                                width="32" height="auto"
                                                                                                src="https://ci3.googleusercontent.com/meips/ADKq_NZyjom-PbEFswqfxGe2Q1BfkFsu-zYij3lcK1KCm-l--7cMS-K8j-t5arXmKs_Ojs0tDb2XYLzrNasE3rbqzRz3dfRyDMOHCUlEihYl_JP7LIHvy0Fpdn-Mib4=s0-d-e1-ft#https://s8659497.sendpul.se/img/constructor/social/round/linkedin.png"></a>
                                                                                    </th>
                                                                                    <th class="m_8878348065808527974social_element"
                                                                                        style="border-color:transparent;padding:2px 5px;font-size:13px;font-family:Arial,sans-serif;line-height:32px;font-weight:400;text-align:left;border-width:0;border-style:none;border:0"
                                                                                        align="left">
                                                                                        <a href="https://s8659497.sendpul.se/a360/public/statistic/v2/click/e58556bb8282b45945489aee99da5057b713"
                                                                                            style="text-decoration:none;color:#0089bf"
                                                                                            target="_blank"
                                                                                            data-saferedirecturl="https://www.google.com/url?hl=pt-BR&amp;q=https://s8659497.sendpul.se/a360/public/statistic/v2/click/e58556bb8282b45945489aee99da5057b713&amp;source=gmail&amp;ust=1724333532019000&amp;usg=AOvVaw24rl6ob7ikd18P3hqfK-6H"><img
                                                                                                border="0" alt="YouTube"
                                                                                                class="m_8878348065808527974social m_8878348065808527974smallImg"
                                                                                                style="height:auto;line-height:100%;outline:0;text-decoration:none;border:0;border-color:transparent;border-width:0;border-style:none;display:block;margin:5px"
                                                                                                vspace="5" hspace="5"
                                                                                                title="YouTube"
                                                                                                width="32" height="auto"
                                                                                                src="https://ci3.googleusercontent.com/meips/ADKq_NbQXFOpOlLt_2yZXqmUBhsu7J-fUZp2FSoVVmze_1P3MvyxTGPI7pTfKf0PDmQEEyciN8o_vGVZZBXlWNh4VPgF7mqrpdu06yEUS1FRcDwapgducNXysBDpRg=s0-d-e1-ft#https://s8659497.sendpul.se/img/constructor/social/round/youtube.png"></a>
                                                                                    </th>
                                                                                </tr>
                                                                            </table>
                                                                            <div
                                                                                style="font-size:14px;line-height:1.5;clear:both">
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                    <table border="0" width="100%" cellpadding="0" cellspacing="0"
                                                        style="border-collapse:collapse;font-size:14px;line-height:1.5;border-top-right-radius:0;border-top-left-radius:0;border-bottom-left-radius:0;border-bottom-right-radius:0">
                                                        <tr style="border-color:transparent">
                                                            <td cellpadding="0" cellspacing="0"
                                                                style="border-collapse:collapse;border-color:transparent;vertical-align:top"
                                                                valign="top">
                                                                <table width="100%" cellpadding="0" cellspacing="0"
                                                                    id="m_8878348065808527974wout_block_out_block_10"
                                                                    style="border-collapse:separate;font-size:14px;line-height:1.5;background-color:#eee;font-weight:normal;margin:0;overflow:hidden"
                                                                    bgcolor="#eeeeee">
                                                                    <tr
                                                                        style="border-color:transparent;color:#444;font-family:Arial,&quot;Helvetica Neue&quot;,Helvetica,sans-serif">
                                                                        <td class="m_8878348065808527974content-cell m_8878348065808527974padding-top-0"
                                                                            width="540"
                                                                            style="border-collapse:collapse;border-color:transparent;vertical-align:top;padding-left:30px;padding-right:30px;padding-top:0;padding-bottom:30px"
                                                                            valign="top">
                                                                            <p style="font-size:inherit;line-height:inherit;margin:0 0 10px;color:inherit;font-family:Arial,&quot;Helvetica Neue&quot;,Helvetica,sans-serif;text-align:center;font-weight:normal;padding:0"
                                                                                align="center">
                                                                                <span style="font-size:13px">Este e-mail
                                                                                    foi enviado para você, porque
                                                                                    solicitou cadastro no sistema
                                                                                    EasyPlan Clientes.
                                                                                </span>
                                                                            </p>
                                                                            <div
                                                                                style="font-size:14px;line-height:1.5;clear:both">
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </th>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</div>
`,
    })
        .then(function (response) {
            res.send({
                message: "Autenticação de dos fatores enviada com sucesso!",
                sucesso: true
            });
        })
        .catch(function (error) {
            res.status(401).send({
                message: error.message,
                sucesso: false
            });
        });
};

module.exports = {
    sendMessageCodeImage,
};