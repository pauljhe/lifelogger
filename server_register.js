//AJAX request handler (server code for registration)
var database 		=	require("./database_handler");
var nodemailInfo	=	require("./nodemailer_info");
var helper 			=	require("./helper_functions");
var bcrypt			=	require("bcrypt-nodejs");
var nodemailer 		=	require("nodemailer");
var EmailTemplate	=	require("email-templates");
var juice 			= 	require("juice");
var ejs				=	require("ejs");
var path 			= 	require("path");

// verifierJson will indicate uniqueness of requested email and nickname
//var verifierJson = {};

// Three steps to process register:
// 1. verify if email is unique. If not, send emailExist = true.
// 2. verify if nickname is unique. If not, send nickExist = true.
// 3. Since both email and nickname are unique, complete registration.

// Helper function to verify if email is unique in database.
function verifyEmail(req, res) {
	var infos = req.body[0];

    // query email to check.
	var queryVerifyEmail = "SELECT email FROM Users WHERE email = ?";
	database.query(req, res, queryVerifyEmail, [infos.email], verifyUnique, verifyNick);
}

// Helper function to verify if nickname is unique in database.
function verifyNick(req, res, verifierJson) {
	// check if emailExist is true, and if true, then send it to client.
	// Otherwise, execute next verifying query.
	if (!verifierJson.emailExist) {
		var infos = req.body[0];

		var queryVerifyNick = "SELECT nick_name FROM Users WHERE nick_name = ?";
		database.query(req, res, queryVerifyNick, [infos.nick_name], verifyUnique, processCodeVerification);
	} else {
		res.end(JSON.stringify(verifierJson));
	}
}

// Helper function to complete registration.
function processCodeVerification(req, res, verifierJson) {
	// Check if nickExist is true, and if true, then send it to client.
	// Otherwise, finish registration by INSERT INTO.
	if (!verifierJson.nickExist) {
		sendVerifyCode(req, res);

	} else {
		res.end(JSON.stringify(verifierJson));
	}
}

//verify if email and nickname are unique.
function verifyUnique(rows, req, res, callback) {
	var jsonObj = {};
/*
    // if query error occurs, send error msg to client
	if (err) {
		jsonObj.msg = err;

		resultJson.push(jsonObj);
		res.end(JSON.stringify(resultJson));
	// if 
	} else {
		//if email/nickname already exists, inform user to type another email/nickname
		if (rows.length !== 0) {
			verifierJson.emailExist = rows[0].email ? true: false;
			verifierJson.nickExist = rows[0].nick_name ? true: false;
		//if email/nickname doesn't exist in database, then set them to false to
		// execute next callback function properly.
		} else {
			verifierJson.emailExist = false;
			verifierJson.nickExist = false;
		}
		// call callback function to execute verifyEmail/verifyNick
		callback(req, res);
	}*/
	//if email/nickname already exists, inform user to type another email/nickname
	if (rows.length !== 0) {
		jsonObj.emailExist = rows[0].email ? true: false;
		jsonObj.nickExist = rows[0].nick_name ? true: false;
	//if email/nickname doesn't exist in database, then set them to false to
	// execute next callback function properly.
	} else {
		jsonObj.emailExist = false;
		jsonObj.nickExist = false;
	}
	// call callback function to execute verifyEmail/verifyNick
	callback(req, res, jsonObj);
}

function sendVerifyCode(req, res) {
	console.log("--sendVerifyCode--");
	var jsonObj = {};

	var transporter = nodemailer.createTransport({
		pool: nodemailInfo.pool,
		host: nodemailInfo.host,
		port: nodemailInfo.port,
		secure: nodemailInfo.secure,
		auth: nodemailInfo.auth
	});

	var emailPath = path.join(__dirname, "templates", "email_verification_code.ejs");
    
    var infos = req.body[0];
	var rand_code = Math.floor(Math.random() * 1000000) + "" //random code of 6 digits

    while (rand_code.length < 6) {
    	rand_code = "0" + rand_code;
    }

    var data = {
		name: 		infos.nick_name,
		code: 		rand_code
    };

    ejs.renderFile(emailPath, data, {}, function(ejsErr, html) {
    	if (ejsErr) {
    		console.log(ejsErr);
    		jsonObj.msg = ejsErr;
		    res.end(JSON.stringify(jsonObj));
    	} else {
    		var juiceOpt = {
    			webResources: {
    				relativeTo: path.join(__dirname, "templates")
    		    }
    		};
    		juice.juiceResources(html, juiceOpt, function(juiceErr, inlineHtml) {
    			if (juiceErr) {
    				console.log(juiceErr);
    				jsonObj.msg = juiceErr;
		            res.end(JSON.stringify(jsonObj));
    			} else {
    				var subj = "Hi, " + infos.nick_name + ". Here is your " +
    				           "verification code. | A Lifelogger";
    				var mailOptions = {
    					from: nodemailInfo.auth.user,
    					to: infos.email,
    					subject: subj,
    					html: inlineHtml
    				};

    				transporter.sendMail(mailOptions, function(mailErr, info) {
    					if (mailErr) {
    						console.log(mailErr);
    						jsonObj.msg = mailErr;
		                	res.end(JSON.stringify(jsonObj));
    					} else {
    						console.log(info);
    						console.log("--------------");
							bcrypt.hash(infos.password, null, null, function(hashErr, hash) {
								console.log("inside of bcrypt.hash~~~");
								if (hashErr) {
									console.log(hashErr);
									jsonObj.msg = hashErr;
								} else {
									var registerInfo = helper.clone(infos);
									registerInfo.password = hash;

									jsonObj.verifSent = 1;
									req.session.code = rand_code;
									req.session.infos = registerInfo;
								}
								console.log("before res.end");
		                	    res.end(JSON.stringify(jsonObj));
							});
    					}
    				});

    			}
    		});
    	}
    });
}


function finishRegistration(req, res) {
	var infos = req.body[0];

	var query = "INSERT INTO Users (email, password, first_name, middle_name," + 
            " last_name, birthday, gender, nick_name, phone_number) " +
            "VALUES ?";

	// bcrypt.hash(infos.password, 10, function(err, hash) {
	// 	if (err) {
	// 		console.log(err);
	// 	} else {
	// 		var vals = [
	// 				[infos.email, hash, infos.first_name, infos.middle_name, infos.last_name,
	// 				infos.birthday, infos.gender, infos.nick_name, infos.phone_number]
	// 			];
	// 		database.query(req, res, query, [vals], registerPostHandler, function(){});
	// 	}
	// });

	var vals = [
			[infos.email, infos.password, infos.first_name, infos.middle_name, infos.last_name,
			infos.birthday, infos.gender, infos.nick_name, infos.phone_number]
		];
	database.query(req, res, query, [vals], registerPostHandler, function(){});


}

// Registration POST ajax request handler.
// Send error msg in case of query error. 
// Otherwise, send registerCode since uniqueness of email/nickname was verified.
function registerPostHandler(rows, req, res, callback) {
	var jsonObj = {};

	// sess = req.session;
	req.session.email = req.body[0].email;
	jsonObj.registerCode = 1; //registration succeeds
	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify(jsonObj));
}


module.exports = {
	verify 	: verifyEmail,
	register: finishRegistration
}