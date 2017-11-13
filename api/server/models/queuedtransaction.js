class QueuedTransaction{
    
    constructor(data, channelname){
        this.docType = data.docType;
        this.transId = data.refID;
        this.channel = channelname;
        this.sender = data.sender;
        this.receiver = data.receiver;
        this.priority = data.priority;
        this.nettable = data.nettable;
        this.transactionAmount = data.amount;   
        this.currency = data.currency;
        this.status = data.status;
        this.isFrozen = data.isFrozen;
        this.requestedDate = data.createTime;
        this.updatedDate = data.updateTime;
    }
    
    
}
    
module.exports = QueuedTransaction;
    
    