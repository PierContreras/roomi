IF OBJECT_ID(N'dbo.alojamientos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.alojamientos (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        title NVARCHAR(200) NOT NULL,
        zone NVARCHAR(60) NOT NULL,
        university NVARCHAR(60) NOT NULL,
        [type] NVARCHAR(40) NOT NULL,
        price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
        deposit DECIMAL(10, 2) NOT NULL CHECK (deposit >= 0),
        minutes INT NOT NULL CHECK (minutes >= 0),
        amenities_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(amenities_json) = 1),
        description NVARCHAR(2000) NOT NULL,
        rules NVARCHAR(2000) NOT NULL,
        address NVARCHAR(250) NOT NULL,
        photos_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(photos_json) = 1),
        [owner] NVARCHAR(200) NOT NULL,
        [status] VARCHAR(12) NOT NULL CHECK ([status] IN ('pending', 'approved', 'rejected', 'withdrawn'))
    );
END;
