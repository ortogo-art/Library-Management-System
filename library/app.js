var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var url = require('url');
var mysql= require('mysql');
var con= mysql.createConnection({
	host:"localhost",
	user: "root",
	password: "12345678",
	database:"libProject"
});
con.connect(function(err){
	if(err) throw err;
	console.log('Connected to the library database!');
});
var index = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);



app.post('/searchresult',function(req,res){
	console.log("posting from search result submit");
	var s= req.body.hi;
	//var sql2="SELECT * FROM searchBook limit 5";
	
    var sql2="SELECT * FROM searchBook WHERE ISBN LIKE \'%"+s+"%\' OR TITLE LIKE \'%"+s+"%\' OR AuthorName LIKE \'%"+s+"%\' OR AuthorID LIKE \'%"+s+"%\'";
    
    var sql4= "UPDATE searchBook SET BookAvailability=\'Yes\' WHERE searchBook.ISBN IN (SELECT isbn FROM book_loans)";
 
  con.query(sql4,function(err,result,fields){
  	if(err) throw err;
  });
  con.query(sql2,function(err,result,fields){
    if(err) throw err;
    res.render('sr.jade',{title:'Search Results',data:result});  
  });
  
});

app.get('/update',function(req,res,next){
	console.log("updating fines...");
	var sql0="insert into fines(card_id,loan_id,fine_amt) select book_loans.card_id,book_loans.loan_id, timestampdiff(day,due_date,NOW())*(0.25) from book_loans where now()>due_date and date_in=\'2017-1-1 1:1:0\' and book_loans.loan_id not in (select fines.loan_id from fines)";
	var sql11="insert into fines(card_id,loan_id,fine_amt) select book_loans.card_id,loan_id, timestampdiff(day,due_date,date_in)*(0.25) from book_loans where date_in>due_date and date_in<>\'2017-1-1 1:1:0\' and book_loans.loan_id not in (select fines.loan_id from fines)";
	var ci="update fines set checked_in=\'y\' where fines.loan_id in (select book_loans.loan_id from book_loans where date_in<>\'2017-1-1 1:1:0\')";
	var sqla="update fines set fine_amt=(select timestampdiff(day,due_date,NOW())*(0.25) from book_loans where now()>due_date and date_in=\'2017-1-1 1:1:0\') where fines.loan_id in (select book_loans.loan_id from book_loans where now()>due_date and date_in=\'2017-1-1 1:1:0\')";
	con.query(sql11,function(err,result,fields){
		if(err) throw err;
		console.log('fine table updated with books that have been checked in but were overdue');
		
	});
	con.query(ci,function(err,result,fields){
			if(err) throw err;
			console.log("updated checked in column to yes");
		});
	con.query(sql0,function(err,result,fields){
		if(err) throw err;
		console.log('fine table updated with books overdue and not checked in');
	});
	
	con.query(sqla,function(err,result,fields){
		if(err) throw err;
		console.log('fine table updated with books overdue, not checked in and fine not paid');
	}); 
	sleep(2000);
	res.redirect("/");

});

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

app.post('/disp',function(req,res){
	console.log("in display functionality");
	var id= req.body.cardid;
	//var sqldisp="select card_id,sum(fine_amt) as s from fines where checked_in=\'y\' group by card_id having card_id="+id;
	var sqldisp="select card_id,sum(fine_amt) as s from fines where paid=0 group by card_id having card_id="+id;
	con.query(sqldisp,function(err,result,fields){
		if(err) throw err;
		console.log("display query run successfully ");
		if(result.length)
		{
			var insql="select card_id,loan_id,fine_amt,checked_in from fines where paid=0 and card_id="+id;
			con.query(insql,function(err,resultin,fields){
					console.log("executing inner disp query");
					res.render('pay.jade',{title:'Fine Payment Page',sum:result[0].s, id:id, data:resultin });

			});
		
		}
		else{
			res.send("The borrower with card id "+id+" does not owe anything!");
		}
	});
});

app.post('/pay',function(req,res){
	console.log('in pay functionality');
	var cid=req.body.loanid;
	//var camt=req.body.payamt;
	var paysql="update fines set paid=1 where loan_id="+cid+" and checked_in=\'y\'";
	con.query(paysql,function(err,result,fields){
		if(err) throw err;
		console.log("in payment functionality");
		
		if(result.affectedRows>0)
		{
			res.send("Payment successful");
			//res.render('index.jade',{pmsg:'Payment successful'});
		}
		else{
			res.send("Please check the loan_id that you entered and try again. Note that you can only pay fines for books that have been checked in");
		}
	});

});

app.post('/checkout',function(req,res){
	console.log("posting from checking out");
	//run sql query to post data into database table 
	var bid= req.body.bid;
	var bookisbn=req.body.bookisbn;
	var sql5="insert into book_loans(`card_id`,`date_out`,`due_date`,`isbn`) values(\'"+bid+"\',now(), DATE_ADD(NOW(), INTERVAL 14 DAY), \'"+bookisbn+"\')";
	//var sql5="insert into book_loans(`card_id`,`date_in`,`due_date`,`isbn`) values(3,now(), DATE_ADD(NOW(), INTERVAL 14 DAY), \'0001047973\')";
	var sql6="select count(*) as d from book_loans where card_id=\'"+bid+"\'";
	var sql7="select count(card_id) as c from book_loans where isbn=\'"+bookisbn+"\'";
	//result is rows
	con.query(sql7,function(err,result,fields){
		
		if(err) throw err;
		if(result[0].c>0)
		{
			var msg="This book has already been checked out!";
			res.render('checkout.jade',{title:"Check Out Message",message:msg});
		}
		else{
				con.query(sql6,function(err,result,fields){
				if(err) throw err;
				console.log(result[0].d);
				if(result[0].d>2)
		{
			var msg="Cannot issue more than three books for the same user!";
			res.render('checkout.jade',{title:"Check Out Message",message:msg});
		}
				else
		{
			con.query(sql5,function(err,result,fields){
			if(err) throw err;
			var msg="Checked out successfully!";
			res.render('checkout.jade',{title:"Check Out Message",message:msg});
	});
		}
		
	});
		}
	});
	
});

app.post('/add',function(req,res){
	console.log("inside add a borrower");
	var bor_name= req.body.bor_name;
	var bor_ssn= req.body.bor_ssn;
	var bor_address= req.body.bor_address;
	var bor_phone = req.body.bor_phone;
	var sql61="select count(*) as a from borrower where Ssn=\'"+bor_ssn+"\'";
	var sql9= "insert into borrower(`Ssn`,`Bname`,`Address`,`Phone`) values(\'"+bor_ssn+"\',\'"+bor_name+"\', \'"+bor_address+"\',\'"+bor_phone+"\')";
	con.query(sql61,function(err,result,fields){
		if(err) throw err;
		if(result[0].a>0)
		{
			var msg1="Could not create borrower. This SSN value already exists!!";
			res.render('add.jade',{title:"Add borrower message",addmessage:msg1});
		}
		else{
			con.query(sql9,function(err,result,fields){
		
		if(err) throw err;
		var msg1="Added borrower";

		res.render('add.jade',{title:"Add borrower message",addmessage:msg1});

	});
		}
	});


	
	
});

app.post('/checkin',function(req,res){
	console.log('check in a book');
	var q= req.body.loanSearch;
	var sql21= "SELECT * FROM (select bl.isbn as BookID, bl.card_id as CardNumber, br.Bname as BorrowerName from book_loans bl, borrower br where bl.card_id=br.Card_ID AND bl.date_out>date_in) as checkin WHERE BookId LIKE \'%"+q+"%\' OR CardNumber LIKE \'%"+q+"%\' OR BorrowerName LIKE \'%"+q+"%\'";

	con.query(sql21,function(err,result,fields){
			if(err) throw err;
			res.render('checkin.jade',{title:"Check In a Book",data:result});
	});
});

app.get('/checkedin/:id',function(req,res){
	
	var i=req.params.id;
	var p=i.slice(1);
	console.log(i);
	var sql12= "update book_loans set date_in=NOW() where isbn=\'"+p+"\'";
	con.query(sql12,function(err,result,fields)
	{
		if(err) throw err;
		console.log('book checked in. table updated.')
		//res.send('checked in book with ISBN '+req.params.id);
		res.render('checkedin.jade',{isbn:req.params.id});
	});
});



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
