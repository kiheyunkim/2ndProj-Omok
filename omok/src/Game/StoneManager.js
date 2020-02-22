import Stone from './Stone';
import './StoneManager.css';
const React = require('react');

class StoneManager extends React.Component{
    constructor(props){
        super(props);
        this.stoneArray = [];
    }

    render(){
        let stones = [];

        for(let i=0;i<20;++i){
            let stoneWrppaer =[];
            for(let j=0;j<20;++j){
                stoneWrppaer.push( 
                <td id = 'stones' key ={j+i}><Stone xPos = {j} yPos = {i} placeStone={this.props.placeStone} /></td>);
            }
            stones.push(
                <tr key ={i+20}>
                    {stoneWrppaer}
                </tr>
            )
        }

        this.stoneArray=stones;

        return(
            <table id = 'omokBoard' cellSpacing="0" cellPadding="0">
                <tbody>
                    {stones}
                </tbody>
            </table>
        )
    }
}

export default StoneManager;