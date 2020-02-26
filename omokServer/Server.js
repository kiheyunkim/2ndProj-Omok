const express = require('express');
const app = express();
const Sha256 = require('sha256');
///https://www.zerocho.com/category/NodeJS/post/57edfcf481d46f0015d3f0cd
app.use(require('cors')({origin:'http://127.0.0.1:3000',credentials:true}));

const server = app.listen(4000, ()=>console.log('Omok Server Open  ---> 4000'));
const IO = require('socket.io').listen(server);
const waitingRoomId = Sha256((Math.random() * 10000).toString());
console.log(waitingRoomId);

let GameRoomList = []
GameRoomList.push({roomid:GameRoomList.length, roomName:'방제목입니다1', member:[], state:'NORMAL', board:[]});
GameRoomList.push({roomid:GameRoomList.length, roomName:'방제목입니다1', member:[], state:'NORMAL', board:[]});
GameRoomList.push({roomid:GameRoomList.length, roomName:'방제목입니다1', member:[], state:'NORMAL', board:[]});
GameRoomList.push({roomid:GameRoomList.length, roomName:'방제목입니다1', member:[], state:'NORMAL', board:[]});
GameRoomList.push({roomid:GameRoomList.length, roomName:'방제목입니다1', member:[], state:'NORMAL', board:[]});
GameRoomList.push({roomid:GameRoomList.length, roomName:'방제목입니다1', member:[], state:'NORMAL', board:[]});
GameRoomList.push({roomid:GameRoomList.length, roomName:'방제목입니다1', member:[], state:'NORMAL', board:[]});

//대기실은 SHA 256으로 랜덤 생성
IO.on('connection',(socket)=>{
    socket.screenState = 'Waiting';                             //이 상태는 소켓의 접속위반 여부를 확인한다. 
    socket.nickname = Sha256((Math.random() * 10000).toString()) ;                              //소켓 구분용 고유값
    socket.roomid = undefined;                                  //현재 소켓이 속해있는 roomid

    socket.on('disconnect',(reason)=>{                          //소켓 접속상태에 변경을 가한 대상들은 모두 종료시킴    //처리자체는 어느 페이지에서도 해야함. 
        if(socket.screenState ==='WaitingRoom'){                //게임중이거나 게임방 대기실에 있을 때만 처리해주면 됨.
            //게임 대기실에 있는 경우에는 상대에게 반대편이 나갔음을 통보하고 채널목록을 갱신시켜준다.
            let room = GameRoomList.find(element=> element.roomid === socket.roomid);
            if(room === undefined){
                console.error('Invalid Socket Request ' + socket.nickname);
                return;
            }
            if(room.member.length === 2){//2명의 경우에는 한명을 내보내 고 다른 한명에게 나감을 통보
                //나간 사람은 목록에서 제외
                room.member = room.member.filter(element => element.nickname !== socket.nickname);  //소켓이 가진 것과 다른 멤버만 남김
                //만약 나간사람이 방장이 아니었다가 방장이 되면 레디상태를 해제해줌
                let other = room.member.find(element => element.nickname !== socket.nickname).readyState = false;
                //통보 해줌 
                socket.broadcast.to(socket.roomid).emit('ReloadRoomMember','');
            }else if(room.member.length === 1){//한명뿐인 방은 그가 나가면 방이 없어져야함.
                GameRoomList = GameRoomList.filter(element => element.roomid !== socket.roomid);
            }
        }else if(socket.screenState === 'Game'){//게임중인경우에는
            let room = GameRoomList.find(element=> element.roomid === socket.roomid);   
            //### ToDo        
            //상대에게 나갔음을 표시해주고 승리 하나를 올려주고 상대의 화면 상태를 변경, 방의 상태또한 변경시켜준다.
        }
 
        socket.disconnect();
    });

    //###################로그인 후 첫 접속 대기실 번호 요청 -->
    socket.on('RequestWaitingRoom',()=>{
        socket.roomid = waitingRoomId;  //현재 속해있는 방의 아이디 -> 대기실 아이디 할당
        socket.join(socket.roomid);     //socket io 상으로 대기실에 넣어준다.
        socket.emit('ScreenChange',{ScreenType :'Waiting'});    //처음 화면을 어디로 옮겨줄지?
    });

    /*
    Todo 로그인 과정을 넣어줘야함.
    */

    //###################대기실
    socket.on('RequestRoomList',()=>{   //방 목록 요청
        socket.emit('ChannelList',{GameRoomList:GameRoomList});
    });
    
    socket.on('WaitingChatting',(recv)=>{//대기실에서 채팅 처리
        let newMessage = recv.message.replace(/</g,'&lt;').replace(/>/g,'&gt;');//XSS방지
        IO.sockets.to(socket.roomid).emit('WaitingChattingResponse',{nickname:socket.nickname, message:newMessage});
    });

    socket.on('RequestRoomCreate',(request)=>{ //방 생성 요청 //클라이언트가 요청한 제목으로 개설해줌
        let newTitle = request.title.replace(/</g,'&lt;').replace(/>/g,'&gt;'); //XSS방지
        let newRoom = {roomid:Sha256((new Date().toString())), roomName:newTitle, member:[], state:'NORMAL'};
        newRoom.member.push({nickname:socket.nickname, readyState:false, teamColor:'blank'});//방 생성
        GameRoomList.push(newRoom);                                      //방 삽입
        socket.leave(socket.roomid);                                     //기존 방 탈출
        socket.roomid = newRoom.roomid;                                  //새로운 방 번호 할당
        socket.join(newRoom.roomid);                                     //새로운 방으로 진입
        socket.screenState = 'WaitingRoom';
        IO.to(socket.id).emit('ScreenChange',{ScreenType :'WaitingRoom'});         //화면상 만든방으로 이동시켜줌
    });
    
    socket.on('RequestEnterRoom',(recv)=>{
        let room = GameRoomList.find(element =>element.roomid === recv.roomid);//해당하는 방을 찾음
        if(room === undefined){
            socket.emit('Result',{type:'Entry', result:'Invalid'});        //방이 없음 -> 잘못된 접근
        }else if(room.member.length < 2){//빈자리는 있음
            //방에 멤버 삽입
            room.member.push({nickname:socket.nickname, readyState:false, teamColor:'blank'});
            //기존방에 대한 처리와 새로운 방으로의 진입, 그리고 새로운 방번호 할당
            socket.leave(socket.roomid);
            socket.roomid = recv.roomid;
            socket.join(recv.roomid);
            //기존 방에 있는 사람들에게 방 목록 리로드 요청
            socket.broadcast.to(socket.roomid).emit('ReloadRoomMember','');
            //소켓의 상태 변경
            socket.screenState = 'WaitingRoom';
            //요청한 대상은 화면전환
            socket.emit('ScreenChange',{ScreenType :'WaitingRoom'});    //해당방으로 이동시켜줌
        }else{
            socket.emit('Result',{type:'Entry', result:'FULL'});   //꽉  차있음.
        }
    });

    //###################게임 대기실
    socket.on('RequestRoomMember',()=>{
        let members = GameRoomList.find(element => element.roomid === socket.roomid).member;
        //요청한 자에게만 보냄.
        IO.to(socket.id).emit('RequestedRoomMember',{members:members, isAmIAdmin:(members[0].nickname === socket.nickname)});
    });

    socket.on('RequestLeaveRoom',()=>{  //방 떠나는 것을 요청
        //게임 대기실에 있는 경우에는 상대에게 반대편이 나갔음을 통보하고 채널목록을 갱신시켜준다.
        let room = GameRoomList.find(element=> element.roomid === socket.roomid);

        if(room === undefined){ //방을 못찾았을 때
            console.error('Invalid Socket Request ' + socket.nickname);
            return;
        }
        
        if(room.member.length === 2){//2명의 경우에는 한명을 내보내고 다른 한명에게 나감을 통보함 -> 참여자 고치기
            room.member = room.member.filter(element => element.nickname !== socket.nickname);  //나간 사람은 목록에서 제외
            //만약 나간사람이 방장이 아니었다가 방장이 되면 레디상태를 해제해줌
            room.member.find(element => element.nickname !== socket.nickname).readyState = false;
            //소켓이 해당힌 방에 나갔음을 통보해준다.
            socket.broadcast.to(socket.roomid).emit('ReloadRoomMember','');
        }else if(room.member.length === 1){//한명뿐인 방은 그가 나가면 방이 없어져야함.
            GameRoomList = GameRoomList.filter(element => element.roomid !== socket.roomid);
        }
        
        //화면 상태 기록
        socket.screenState = 'Waiting';
        //화면 전환 시켜줌
        socket.emit('ScreenChange',{ScreenType :'Waiting'});
        //기존의 
        socket.leave(socket.roomid);
        socket.roomid = waitingRoomId;
        socket.join(waitingRoomId);
    });

    //채팅
    socket.on('roomchating',(recv)=>{//방안에서 채팅 처리
        let newMessage = recv.message.replace(/</g,'&lt;').replace(/>/g,'&gt;');
        IO.to(socket.roomid).emit('roomMessage',{nickname:socket.nickname, message:newMessage});
    });

    socket.on('ReadyStateChangeRequest',()=>{
        //소켓에 해당하는 소켓 찾기
        let targetRoom = GameRoomList.find(element=>element.roomid === socket.roomid);
        let selfMember = targetRoom.member.find(element => element.nickname === socket.nickname);
        
        //방장인가 아닌가?
        if(targetRoom.member[0].nickname === socket.nickname){      //방장 인경우
            //상대가 레디상태인가 검사?
            let otherMember = targetRoom.member.find(element => element.nickname !== socket.nickname);
            if(otherMember.readyState){                             //레디 상태이면 시작
                //1. 팀할당 -> 색
                selfMember.teamColor = 'black';
                otherMember.teamColor = 'white';
                //2. 턴할당 -> 
                targetRoom.turn = 0;    //0번부터 시작할 수 있도록. 
                //방장의 화면 전환을 기록해줌
                socket.screenState = 'Game';
                //방에 있는 보드 초기화 
                targetRoom.board = [];
                for(let i=0;i<20;++i){
                    for(let j=0;j<20;++j){
                        targetRoom.board.push(0);
                    }
                }

                //시작하도록 클라들에게 전달
                IO.to(socket.roomid).emit('ScreenChange',{ScreenType :'Game'});
                
                
            }else{//시작 불가 - 상대가 아직 레디 하지 않음
                //레디 안했다는 메세지 전달
                IO.to(socket.id).emit('StartFail','');
            }
        }else{                                                      //아닌 경우엔 방장 아닌 사람이 레디한것.
            //레디 상태만 바꿈
            selfMember.readyState = !selfMember.readyState;
            //소켓의 화면 상태 갱신
            if(selfMember.readyState){//레디가 됐으면 게임상태
                socket.screenState = 'Game';
            }else{
                socket.screenState = 'WaitingRoom';
            }
            //방의 모두에게 갱신을 통보
            IO.to(socket.roomid).emit('ReloadRoomMember','');
        }
    });

    //게임 화면 -----------------------------
    socket.on('RequestGameSetting',(recv)=>{
        let targetRoom = GameRoomList.find(element=>element.roomid === socket.roomid);
        let selfMember = targetRoom.member.find(element=>element.nickname === socket.nickname);
        
        IO.to(socket.id).emit('GameInitialization',{color:selfMember.teamColor, isYourTurn: (targetRoom.member[targetRoom.turn].nickname === socket.nickname ? true : false)});
    });

    //GameRoomList.push({roomid:GameRoomList.length, roomName:'방제목입니다1', member:[], state:'NORMAL', board:[]});
    //돌 놓는거 확인
    socket.on('StonePlace',(recv)=>{
        let targetRoom = GameRoomList.find(element=>element.roomid === socket.roomid);

        //놓는 그 위치에는 돌이 있는가?
        if(targetRoom.board[recv.xPos + recv.yPos * 20] !== 0){
            IO.to(socket.id).emit('PlaceResult',{Result:'WrongPos'});
            return;
        }

        //팀 파악
        let team = 0;
        if(targetRoom.member.find(element=>element.nickname===socket.nickname).teamColor === 'black'){
            team = 1;
        }else{
            team = 2;
        }

        //서버상에 돌을 놓음
        targetRoom.board[recv.xPos + recv.yPos * 20] = team;
        
        //돌 놓음을 통지
        IO.sockets.to(socket.roomid).emit('PlaceStone',{xPos:recv.xPos,yPos:recv.yPos, team:team});

        //승리 했는지 체크
        let isVictory = false;
        /*
        //-> 8방향 체크
        //북쪽
        let count = 1;
        while(count < 5 && )


        
        if(isVictory){//승리했다고 통보
        
        }else{//다음 턴을 통보

        }*/
        socket.broadcast.to(socket.roomid).emit('PlaceResult',{Result:'YourTurn'});
    })


    //let targetRoom = GameRoomList.find(element=>element.roomid === socket.roomid);
    //let stateTarget = targetRoom.member.find(element=>element.nickname === socket.nickname);

/*

    

    //레디
    socket.on('RequestReady',(recv)=>{
        

    })
    //시작
    */
});


        //IO.sockets.in(socket.roomId).emit('Result',{roomId : socket.roomId});   //같은 roomID에 대해서만 보내는 방법
        //IO.sockets.in(socket.roomId).emit('ScreenChange',{ScreenType :'Waiting'});    //처음 화면을 어디로 옮겨줄지?