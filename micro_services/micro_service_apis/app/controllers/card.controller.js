const db = require("../../../../models");
const Card = db.card;
const UserCard = db.userCard;

exports.cardRegister = (req, res) => {
    // Save Card to Database
    Card.create({
            cardnumber: req.body.cardnumber,
            mmaa: req.body.mmaa,
            cvc: req.body.cvc,
            cardname: req.body.cardname,
        })
        .then(card => {
            if (card) {
                UserCard.create({
                        cardId: card.id,
                        userId: req.body.userid
                    })
                    .then(usercard => {
                        if (usercard) {
                            res.send({ message: "Cartão cadastrado com sucesso!" });
                        } else {
                            Card.destroy({
                                where: {
                                    id: card.id
                                }
                            }).then();
                            res.status(401).send({ message: err.message });
                        }
                    })
                    .catch(err => {
                        Card.destroy({
                            where: {
                                id: card.id
                            }
                        }).then();
                        res.status(500).send({ message: err.message });
                    });
            } else {
                res.status(401).send({ message: err.message });
            }
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};