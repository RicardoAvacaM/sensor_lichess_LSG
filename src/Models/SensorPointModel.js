class SensorPointModel {
    constructor(id_point_sensor, 
        id_sensor, 
        id_players, 
        data_point,
        date_time,
        hours_played,
        karma_player,
        reputation_player,
        tipe_sensor) {
        this.id_point_sensor = id_point_sensor;
        this.id_sensor = id_sensor;
        this.id_players = id_players;
        this.data_point = data_point;
        this.date_time = date_time;
        this.hours_played = hours_played;
        this.karma_player = karma_player;
        this.reputation_player = reputation_player;
        this.tipe_sensor = tipe_sensor;
    }
}

export default SensorPointModel;