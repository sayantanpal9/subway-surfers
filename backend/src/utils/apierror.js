class errMsg extends Error
{
    constructor(status, message, error, expected) {
        super(message);
        this.status = status;
        this.error = error;
        this.expected = expected;
    }
}

export {errMsg}