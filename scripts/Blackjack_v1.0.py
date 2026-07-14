#   ♠ ♥ BLACKJACK ♦ ♣ v1.0   #
# Created by Nicholas Crouse #
#----------------------------#
import random
import maya.cmds as cmds

gameWindow = "blackjack"

if cmds.window(gameWindow, exists=True):
    cmds.deleteUI(gameWindow)

if cmds.windowPref(gameWindow, exists=True):
    cmds.windowPref(gameWindow, remove=True)

gameWindow = cmds.window(gameWindow, title="♤ ♡ Blackjack ♢ ♧")

winWidth=300

cmds.columnLayout(adjustableColumn=True)

cmds.separator(bgc=[1,1,1])
cmds.text(label="<font color='#FFFFFF'>♠ ♥ BLACKJACK ♦ ♣ v1.0</font>", align="center", bgc=[1,0,0],font="boldLabelFont")
cmds.separator(bgc=[1,1,1])
cmds.text(label="")
cmds.text("<font color='#11a1fa'>Dealer</font>", align="left", font="boldLabelFont")
cmds.separator(bgc=[0.1,0.8,1])
delHand = cmds.text(label="", align="center")
delTotal = cmds.text(label="", align="center")
cmds.text(label="")
cmds.text("<font color='#fa8911'>You</font>", align="left",font="boldLabelFont")
cmds.separator(bgc=[1,0.6,0])
plaHand = cmds.text(label="", align="center")
plaTotal = cmds.text(label="", align="center")
cmds.text(label="")
cmds.separator(style='none')
cmds.text(label="")

status = cmds.text("Hit or Stand", align="center",font="boldLabelFont")
cmds.rowLayout(numberOfColumns=2,adjustableColumn=True,columnAlign2=("center", "center"))
hitBtn = cmds.button(label="Hit", width=winWidth/2,bgc=[0,1,0])
standBtn = cmds.button(label="Stand", width=winWidth/2,bgc=[1,0,0])
cmds.setParent("..")
newGameBtn = cmds.button(label="New Game", width=winWidth,bgc=[0.6,0.6,0.6],enable=False)
cmds.text(label="")
cmds.separator(bgc=[1,1,1])
cmds.showWindow(gameWindow)
cmds.window(gameWindow, edit=True, widthHeight=(winWidth, 250))

# Icon Convert
def iconConvert(suit):
    if suit == "Hearts":
        return "♥"
    elif suit == "Diamonds":
        return "♦"
    elif suit == "Clubs":
        return "♣"
    else:
        return "♠"

# Game Logic
def game(delHand, delTotal, plaHand, plaTotal, iconConvert):
    suits = ["Hearts", "Diamonds", "Clubs", "Spades"]
    cardNum = ["Ace","2","3","4","5","6","7","8","9","10","Jack","Queen","King"]
    deck = []
    dealer = []
    player = []
    discard = []

    cmds.text(status, edit=True, label="Hit or Stand")

    cmds.button(newGameBtn, edit=True, enable=False)
    cmds.button(hitBtn, edit=True, enable=True)
    cmds.button(standBtn, edit=True, enable=True)
# Dealer Action
    def dealerAction(num, a):
        if num < 17:
            return(True)
        elif num == 17 and a:
            return(True)
        elif num == 22 and a:
            return(True)
        else:
            return(False)

# Player total calculation
    def calculateTotal(hand):
        totalCount = 0
        for num in range(len(hand)):
            if hand[num][0] == "Jack" or hand[num][0] == "Queen" or hand[num][0] == "King":
                totalCount += 10
            elif hand[num][0] == "Ace":
                totalCount += 11
            else:
                totalCount += int(hand[num][0])
        return totalCount

# Reveal Deck
    def showHand(hand):
        textReturn = ""
        for x in hand:
            textReturn += x[0] + iconConvert(x[1]) + ", "
        return textReturn[:-2]

    for x in suits:
        for y in cardNum:
            deck.append([y,x])
    random.shuffle(deck)

# Deal Player
    player.append(deck.pop())

# Dealer
    dealer.append(deck.pop())

# Deal Player
    player.append(deck.pop())

# Dealer
    dealer.append(deck.pop())
    print("Dealers Card: " + str(dealer[0][0]) + " of " + str(dealer[0][1]))
    cmds.text(delHand, edit=True, label=str(dealer[0][0]) + iconConvert(str(dealer[0][1])))
    cmds.text(delTotal, edit=True, label="")
    cmds.text(plaHand, edit=True, label=showHand(player))
    cmds.text(plaTotal, edit=True, label="Total: " + str(calculateTotal(player)))
    
    """ OLD Console Player turn
    while True:
        print("Your Hand: " + showHand(player))
        print("Your Total: " + str(calculateTotal(player)))

        response = str(input("Hit or Stand (h/s): ")).lower()
        if response == "h" or response == "hit":
            print("Hit")
            player.append(deck.pop())
        elif response == "s" or response == "stand": 
            break
        if calculateTotal(player) > 21:
            print("You bust with: " + str(calculateTotal(player)))
            cmds.text(status, edit=True, label="You bust with: " + str(calculateTotal(player)))
            break
    """
# Player's Turn
    def playerTurn(action):
        if(action):
            player.append(deck.pop())
            cmds.text(plaHand, edit=True, label=showHand(player))
            cmds.text(plaTotal, edit=True, label="Total: " + str(calculateTotal(player)))
            if calculateTotal(player) > 21:
                cmds.text(status, edit=True, label="You bust with: " + str(calculateTotal(player)))
                playerTurn(False)
        else:
            if calculateTotal(player) > 21:
                cmds.text(status, edit=True, label="You bust with: " + str(calculateTotal(player)))
            playerTotal = calculateTotal(player)
            total = 0
            hasAce = False
            cmds.button(hitBtn, edit=True, enable=False)
            cmds.button(standBtn, edit=True, enable=False)
        # Dealers Turn
            while True:
                for num in range(len(dealer)):
                    if dealer[num][0] == "Jack" or dealer[num][0] == "Queen" or dealer[num][0] == "King":
                        total += 10
                    elif dealer[num][0] == "Ace":
                        total += 11
                        hasAce = True
                    else:
                        total += int(dealer[num][0])
                if total > 21 and hasAce:
                    total -= 10
                if dealerAction(total, hasAce):
                    total = 0
                    dealer.append(deck.pop())
                else:
                    break
        # Game Finish
            if total <= 21:
                print("Dealer stands on " + str(total))
                print("Dealer's Hand: " + showHand(dealer))
                cmds.text(delHand, edit=True, label=showHand(dealer))
                cmds.text(delTotal, edit=True, label="Total: " + str(total))
            else:
                print("Dealer bust on " + str(total))
                print("Dealer's Hand: " + showHand(dealer))
                cmds.text(delHand, edit=True, label=showHand(dealer))
                cmds.text(delTotal, edit=True, label="Total: " + str(total))
            print("Your total: " + str(calculateTotal(player)))
            print("Your Hand: " + showHand(player))

            if playerTotal > 21 and total > 21:
                print("<font color='#FFFF00'>Draw</font>")
                cmds.text(status, edit=True, label="<font color='#FFFF00'>Draw</font>")
            elif playerTotal > 21:
                print("<font color='#FF0000'>You Lose!</font>")
                cmds.text(status, edit=True, label="<font color='#FF0000'>You Lose!</font>")
            elif total > 21:
                print("<font color='#00FF00'>You Win!</font>")
                cmds.text(status, edit=True, label="<font color='#00FF00'>You Win!</font>")
            elif playerTotal > total:
                print("<font color='#00FF00'>You Win!</font>")
                cmds.text(status, edit=True, label="<font color='#00FF00'>You Win!</font>")
            elif playerTotal < total:
                print("<font color='#FF0000'>You Lose!</font>")
                cmds.text(status, edit=True, label="<font color='#FF0000'>You Lose!</font>")
            else:
                print("<font color='#FFFF00'>Draw</font>")
                cmds.text(status, edit=True, label="<font color='#FFFF00'>Draw</font>")
            cmds.button(newGameBtn, edit=True, enable=True, command=lambda *_: game(delHand, delTotal, plaHand, plaTotal, iconConvert))
    cmds.button(hitBtn, edit=True, command=lambda *_: playerTurn(True))
    cmds.button(standBtn, edit=True, command=lambda *_: playerTurn(False))
game(delHand, delTotal, plaHand, plaTotal, iconConvert)
""" ToDO
- Dealer will know players hand
- Fix bug with Dealer hitting after losing with Ace
- Player and Dealer will take turns
- Discard Cards until deck is used
- Auto stand on black jack
- Win counter
- Lose Counter
- Push Counter (Draw)
"""
