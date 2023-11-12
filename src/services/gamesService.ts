import { Bet, Game } from "@prisma/client";
import { InvalidDataError } from "errors/InvalidDataError";
import { NotFoundError } from "errors/NotFoundError";
import betsRepository from "repositories/betsRepository";
import gamesRepository from "repositories/gamesRepository";
import participantsRepository from "repositories/participantsRepository";
import { createGamesType } from "schemas/gamesSchema";

async function createGame(gameData: createGamesType): Promise<Game> {
    if(!gameData) throw InvalidDataError("Game information must be submitted.");

    return await gamesRepository.createGame(gameData);
}

async function getGames(): Promise<Game[]>{
    return await gamesRepository.getGames();
}

async function getGamesById(gameId: number): Promise<Game>{
    const game = await gamesRepository.getGamesById(gameId); 

    if(!game) throw NotFoundError("The game with this id does not exist.");

    return game;
}

async function finishGame(gameId: number, homeTeamScore: number, awayTeamScore: number): Promise<Game> {
    const game = await gamesRepository.finishGame(gameId, homeTeamScore, awayTeamScore);

    if(!game) throw NotFoundError("The game with this id does not exist.");

    const bets = game.bets;

    if(bets.length === 0) return await gamesRepository.getGamesById(gameId);

    let sumOfBetsWon = 0;
    let sumOfAllBets = 0;
    const tax = 0.3;

    let betsAfterGame: Bet[] = bets.map( bet => {
        let newStatus = "PENDING";

        sumOfAllBets += bet.amountBet;

        if(bet.homeTeamScore === homeTeamScore && bet.awayTeamScore === awayTeamScore){
            newStatus = "WON";
            sumOfBetsWon += bet.amountBet;
        }
        else{
            newStatus = "LOST";
        }
        
        return {
            ...bet,
            status: newStatus,
        }
    });
    
    const winners = [];

    betsAfterGame = betsAfterGame.map( bet => {
        let newAmount = 0;

        if(bet.status === "LOST"){
            return {
                ...bet,
                amountWon: 0
            }
        }
        else if(bet.status === "WON"){
            
            newAmount = Math.floor((bet.amountBet / sumOfBetsWon) * (sumOfAllBets) * (1 - tax));

            winners.push({id: bet.participantId, balance: newAmount});

            return {
                ...bet,
                amountWon: newAmount
            }
        }
    })

    await betsRepository.finishBets(betsAfterGame);
    await participantsRepository.resultOfParticipantsBets(winners);

    return await gamesRepository.getGamesById(gameId);
}

const gamesService = {
    createGame, getGames, getGamesById, finishGame
};

export default gamesService;