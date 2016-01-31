//Copyright (C) 2015 <>< Charles Lohr, see LICENSE file for more info.
//
//This particular file may be licensed under the MIT/x11, New BSD or ColorChord Licenses.

// var wsUri = "ws://" + location.host + ":81/";
// var wsUri = "ws://espsocket.local:81/";
var wsUri = "ws://192.168.1.185:81/";

var output;
var websocket;
var commsup = 0;

var workqueue = [];
var workarray = {};
var lastitem;

var SystemMessageTimeout = null;

function progress(percent, $element) {
    var progressBarWidth = percent * $element.width() / 100;
    $element.find('div').animate({ width: progressBarWidth }, 0).html(percent + "% ");
}

function IssueSystemMessage( msg )
{
	var elem = $( "#SystemMessage" );
	elem.hide();
	elem.html(  "<font size=+2>" + msg + "</font>" );
	elem.fadeIn( 'slow' );
	if( SystemMessageTimeout != null ) clearTimeout(SystemMessageTimeout);
	SystemMessageTimeout = setTimeout( function() { SystemMessageTimeout = null; $( "#SystemMessage" ).fadeOut( 'slow' ) }, 3000 );
}

function QueueOperation( command, callback )
{
	if( workarray[command] == 1 ){
		return;
	}

	workarray[command] = 1;
	var vp = new Object();
	vp.callback = callback;
	vp.request = command;
	workqueue.push( vp );
}


function init()
{
	output = document.getElementById("output");
	Ticker();

	LDRTickerStart();
	RGBTickerStart();
	ButtonTickerStart();
}

window.addEventListener("load", init, false);

function StartWebSocket()
{
	output.innerHTML = "Connecting...";
	if( websocket ) websocket.close();
	workarray = {};
	workqueue = [];
	lastitem = null;
	websocket = new WebSocket(wsUri, ['arduino']);
	websocket.onopen = function(evt) { onOpen(evt) };
	websocket.onclose = function(evt) { onClose(evt) };
	websocket.onmessage = function(evt) { onMessage(evt) };
	websocket.onerror = function(evt) { onError(evt) };
}

function onOpen(evt)
{

//	websocket.send('Hello from ESP8266 ' + new Date()); 
	websocket.send('ping');
}

function onClose(evt)
{
	commsup = 0;
	$('#SystemStatusClicker').css("color", "red" );
}

var msg = 0;
var tickmessage = 0;
var lasthz = 0;
var time_since_hz = 0;
function Ticker()
{
	setTimeout( Ticker, 1000 );

	lasthz = (msg - tickmessage);
	tickmessage = msg;
	if( lasthz == 0 )
	{
		time_since_hz++;
		if( time_since_hz > 3)
		{
			FPS.innerHTML = "<p style=\"color:red; font-size:32px\">Offline!</p>"
			if( commsup != 0 ) IssueSystemMessage( "WebSocket Connection Lost..." );
			commsup = 0;
			// setTimeout(function(){ StartWebSocket(); }, 3000);
			StartWebSocket();
		}
		else
		{
			FPS.innerHTML = "<p style=\"color:red; font-size:32px\">Online: " + 0 + " Hz</p>"
		}
	}
	else
	{
		time_since_hz = 0;
		FPS.innerHTML = "<p style=\"color:green; font-size:32px\">Online: " + lasthz + " Hz</p>"
	}
}

function onMessage(evt)
{
	msg++;
	if( commsup != 1 ){
		commsup = 1;
		$('#SystemStatusClicker').css("color", "green" );
		IssueSystemMessage( "WebSocket Connected!" );
	}

	if( lastitem ){
		if( lastitem.callback ){
			lastitem.callback( lastitem, evt.data );
			lastitem = null;
		}
	}
	else{
		output.innerHTML = "<p>Messages: " + msg + "</p><p>RSSI: " + evt.data.substr(0) + "</p>";	
	}

	if( workqueue.length ){
		var elem = workqueue.shift();
		delete workarray[elem.request];

		if( elem.request ){
			doSend( elem.request );
			lastitem = elem;
			return;
		}
	}

	doSend('wx'); //Request RSSI.
}

function sendRGB(){
	var r = parseInt(document.getElementById('r').value/4).toString(16);  
	var g = parseInt(document.getElementById('g').value/4).toString(16);  
	var b = parseInt(document.getElementById('b').value/4).toString(16);  
	if(r.length < 2) { r = '0' + r; }   
	if(g.length < 2) { g = '0' + g; }   
	if(b.length < 2) { b = '0' + b; }   
	if(r == 'NaN') {r = '00'; }
	if(g == 'NaN') {g = '00'; }
	if(b == 'NaN') {b = '00'; }
	var rgb = '#'+r+g+b;    
	console.log('RGB: ' + rgb); 
	QueueOperation(rgb);
}

function onError(evt)
{
	$('#SystemStatusClicker').css("color", "blue" );
	commsup = 0;
}

function doSend(message)
{
	websocket.send(message);
}

function IsTabOpen( objname )
{
	var obj = $( "#" + objname );
	var opened = obj.is( '.opened' );
	return opened != 0;
}

function ShowHideEvent( objname )
{
	var obj = $( "#" + objname );
	obj.slideToggle( 'fast' ).toggleClass( 'opened' );
	var opened = obj.is( '.opened' );
	localStorage["sh" + objname] = opened?1:0;
	return opened!=0;
}

function LDRTicker()
{
	if( !IsTabOpen('LDR') ) return;
	QueueOperation( "L", LDRUpdate );
	setTimeout( LDRTicker, 500 );
}

function LDRTickerStart()
{
	if( IsTabOpen('LDR') )
	LDRTicker();
}

function RGBTicker()
{
	if( !IsTabOpen('RGB') ) return;
	sendRGB();
	setTimeout( RGBTicker, 500 );
}

function RGBTickerStart()
{
	if( IsTabOpen('RGB') )
	RGBTicker();
}

function ButtonTicker()
{
	if( !IsTabOpen('ButtonState') ) return;
	QueueOperation( "B", ButtonUpdate );
	setTimeout( ButtonTicker, 500 );
}

function ButtonTickerStart()
{
	if( IsTabOpen('ButtonState') )
	ButtonTicker();
}

function LDRUpdate(req,data) 
{
	// console.log("LDR: " + data.substr(0));
   	document.getElementById("LDRvalue").innerHTML = data.substr(0);
   	progress(Math.round(Number(data.substr(0))/10.24), $('#progressBar'));
// progress(40.24, $('#progressBar'));

	if( IsTabOpen('LDR') )
	QueueOperation( "L", LDRUpdate );
}

function ButtonUpdate(req,data) 
{
	// console.log("Button: " + data.substr(0));
	if(data.substr(0) == '0'){
   	$('#ButtonStatus').css("color", "Green" );
   	document.getElementById("ButtonStatus").innerHTML = "On";
   	}
   	else{
   	$('#ButtonStatus').css("color", "Red" );
   	document.getElementById("ButtonStatus").innerHTML = "Off";
	}
	if( IsTabOpen('ButtonState') )
	QueueOperation( "B", ButtonUpdate );
}

