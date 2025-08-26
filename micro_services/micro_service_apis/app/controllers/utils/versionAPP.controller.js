
exports.getVersionAPPCliente = (req, res) => {
    res.send(
        {
            "android": {
                "current": "1.0.30",
                "enabled": true,
                "majorMsg": {
                    "title": "Atualização importante!",
                    "msg": "Atualize seu aplicativo para a versão mais recente para continuar a usá-lo.",
                    "btn": "Atualizar"
                },
                "communication": {
                    "enabled": false,
                    "majorMsg": {
                        "title": "Comunicado!",
                        "msg": "Prezado(a) usuário(a), <br /><br />Devido a uma atualização de segurança, solicitamos que você crie uma nova senha de acesso para sua conta. Para fazer isso, por favor, clique no botão <b>Primeiro Acesso</b> e siga os passos indicados para a criação da senha.<br /><br />Agradecemos pela compreensão e cooperação.<br /><br />Atenciosamente,<br />Equipe <b>EasyPlan</b>",
                        "btn": "Entendi"
                    },
                    "logged": false
                }
            },
            "ios": {
                "current": "1.0.30",
                "enabled": true,
                "majorMsg": {
                    "title": "Atualização importante!",
                    "msg": "Atualize seu aplicativo para a versão mais recente para continuar a usá-lo.",
                    "btn": "Atualizar"
                },
                "communication": {
                    "enabled": false,
                    "majorMsg": {
                        "title": "Comunicado!",
                        "msg": "Prezado(a) usuário(a), <br /><br />Devido a uma atualização de segurança, solicitamos que você crie uma nova senha de acesso para sua conta. Para fazer isso, por favor, clique no botão <b>Primeiro Acesso</b> e siga os passos indicados para a criação da senha.<br /><br />Agradecemos pela compreensão e cooperação.<br /><br />Atenciosamente,<br />Equipe <b>EasyPlan</b>",
                        "btn": "Entendi"
                    },
                    "logged": false
                }
            },
            "web": {
                "current": "1.0.30",
                "enabled": false,
                "majorMsg": {
                    "title": "Atualização importante!",
                    "msg": "Atualize seu aplicativo para a versão mais recente para continuar a usá-lo.",
                    "btn": "Atualizar"
                },
                "communication": {
                    "enabled": false,
                    "majorMsg": {
                        "title": "Comunicado!",
                        "msg": "Prezado(a) usuário(a), <br /><br />Devido a uma atualização de segurança, solicitamos que você crie uma nova senha de acesso para sua conta. Para fazer isso, por favor, clique no botão <b>Primeiro Acesso</b> e siga os passos indicados para a criação da senha.<br /><br />Agradecemos pela compreensão e cooperação.<br /><br />Atenciosamente,<br />Equipe <b>EasyPlan</b>",
                        "btn": "Entendi"
                    },
                    "logged": false
                }
            }
        }
    );
};

exports.getVersionAPPCorretor = (req, res) => {
    res.send(
        {
            "android": {
                "current": "1.0.15",
                "enabled": true,
                "majorMsg": {
                    "title": "Atualização importante!",
                    "msg": "Atualize seu aplicativo para a versão mais recente.",
                    "btn": "Atualizar"
                },
                "communication": {
                    "enabled": false,
                    "majorMsg": {
                        "title": "Comunicado!",
                        "msg": "Caro usuário. <br /><br />Devido a uma atualização de segurança, é preciso criar uma senha de acesso a sua conta. <br />Para isso, basta clicar no botão <b> Primeiro Acesso </b> e seguir os próximos passos de criação.",
                        "btn": "Entendi"
                    },
                    "logged": false
                }
            },
            "ios": {
                "current": "1.0.15",
                "enabled": true,
                "majorMsg": {
                    "title": "Atualização importante!",
                    "msg": "Atualize seu aplicativo para a versão mais recente.",
                    "btn": "Atualizar"
                },
                "communication": {
                    "enabled": false,
                    "majorMsg": {
                        "title": "Comunicado!",
                        "msg": "Caro usuário. <br /><br />Devido a uma atualização de segurança, é preciso criar uma senha de acesso a sua conta. <br />Para isso, basta clicar no botão <b> Primeiro Acesso </b> e seguir os próximos passos de criação.",
                        "btn": "Entendi"
                    },
                    "logged": false
                }
            },
            "web": {
                "current": "1.0.15",
                "enabled": false,
                "majorMsg": {
                    "title": "Atualização importante!",
                    "msg": "Atualize seu aplicativo para a versão mais recente.",
                    "btn": "Atualizar"
                },
                "communication": {
                    "enabled": false,
                    "majorMsg": {
                        "title": "Comunicado!",
                        "msg": "Caro usuário. <br /><br />Devido a uma atualização de segurança, é preciso criar uma senha de acesso a sua conta. <br />Para isso, basta clicar no botão <b> Primeiro Acesso </b> e seguir os próximos passos de criação.",
                        "btn": "Entendi"
                    },
                    "logged": false
                }
            }
        }
    );
};