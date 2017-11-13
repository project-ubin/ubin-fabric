var helper = require('../utils/helper.js');

class Transaction{
    constructor(data, channelName){
        this.channelName = channelName; //query
        this.transType = data.docType; 
        this.transId = data.refID;
        this.sender = data.sender;
        this.receiver = data.receiver;
        this.transactionAmount = data.amount;   
        this.currency = data.currency;
        this.status = data.status;
        this.requestedDate = data.createTime;
        this.updatedDate = data.updateTime;
        this.accountID = data.accountID;
        this.channelFrom = data.channelFrom
        this.channelTo = data.channelTo
        this.cleanUp();
    }

    cleanUp(){
         //completedtx - OK
         //pledge & redeem
        if(this.sender == null && this.receiver == null){
            if(this.transType === 'pledgefund'){ //pledge
                this.sender = helper.regulators[0];
                this.receiver = this.accountID;
                this.status = "CREATED";
                this.updatedDate = this.requestedDate;
            } else if (this.transType === 'redeemfund'){ //redeem
                this.receiver = helper.regulators[0];
                this.sender = this.accountID;
                this.status = "CREATED";
                this.updatedDate = this.requestedDate;    
            }
        }
        //moveoutfund & moveinfund 
        if(this.transType === 'moveinfund' || this.transType === 'moveoutfund'){
                this.updatedDate = this.requestedDate;
                this.status = "CREATED";
                this.sender = this.channelFrom;
                this.receiver = this.channelTo;
        } 
        //NettingAdd & NettingSubtract
        if(this.transType === 'nettingsubtract'){
            this.updatedDate = this.requestedDate;
            this.status = "CREATED";
            this.sender = this.accountID;
            this.receiver = helper.regulators[0]
        } 
        if(this.transType === 'nettingadd'){
            this.updatedDate = this.requestedDate;
            this.status = "CREATED";
            this.sender = helper.regulators[0]
            this.receiver = this.accountID;
        } 


        delete this.channelTo;
        delete this.channelFrom;
        delete this.accountID;
    }

}
    
module.exports = Transaction;
    
    
