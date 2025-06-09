const db = require("../../../../models");
const Card = db.card;
const UserCard = db.userCard

checkCardUser = (req, res, next) => {
    // Card
    Card.findOne({
        where: {
            cardnumber: req.body.cardnumber
        }
    }).then(card => {
        if (card) {
            UserCard.findOne({
                where: {
                    cardId: card.id,
                    userId: req.body.userid
                }
            }).then(usercard => {
                if (usercard) {
                    res.status(400).send({
                        message: "Falhou! o Cartão já está cadastrado para esse usuário!"
                    });
                    return;
                } else {
                    next();
                }
            })
        } else {
            next();
        }
    });
};


const checkCard = checkCardUser;

module.exports = checkCard;